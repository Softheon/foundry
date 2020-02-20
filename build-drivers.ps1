param (
    [Parameter(Position = 0, mandatory = $true)]
    [string] $M2
)

function Verify-Driver {
    param (
        $Driver
    )
    Write-Host "Verifying $Driver driver..."
    $DriverFile = "resources\modules\$Driver.metabase-driver.jar"
    if (!(Test-Path -Path $DriverFile)) {
        return $false;
    }
    Write-Host "File exits."

    $MungedDriver = $Driver -replace "-", "_"
    $DriverMainClass = "metabase/driver/$($MungedDriver)__init.class"

    $command = "jar -tf $DriverFile"

    $Files = Invoke-Expression -Command $command -ErrorAction Stop
    $result = $false
    foreach ($File in $Files) {
        if ($File -eq $DriverMainClass) {
            $result = $true
            break;
        }
    }

    if ($result) {
        Write-Host "Main class file found."
    }
    else {
        Write-Error "Main class file missing. Driver verification failed"
        return $false
    }

    Write-Host "Checking whether driver contains plugin manifeset..."

    $result = $false
    foreach ($File in $Files) {
        if ($File -eq "metabase-plugin.yaml") {
            $result = $true
            break;
        }
    }

    if ($result) {
        Write-Host "Plugin Manifest found."
    }
    else {
        Write-Error "Plugin manifest missing. Driver verification failed."
        return $false
    }
    Write-Host "Driver verification successful."
    return $true
}

################################ DELETING OLD INCORRECTLY BUILT DRIVERS ###############################
function Verify-ExistingBuild () {
    Param(
        $Driver,
        $ChecksumFile
    )
    $VerificationStatus = Verify-Driver -Driver $Driver
    if (!$VerificationStatus) {
        Write-Host "No existing build, or existing build is invalid. (Re)building driver."
        Remove-Item -Path $ChecksumFile -Force -ErrorAction Ignore
    }
    return $true
}

######################################## BUILDING THE DRIVER ########################################

# Delete existing saved copies of the driver in the plugins and resources directories
function Delete-OldDrivers() {
    Param(
        $Driver,
        $DriverJar,
        $DestLocation
    )
    Write-Host "Deleting old versions of $Driver driver..."
    Remove-Item -Force -Path "plugins\$DriverJar" -ErrorAction Ignore
    Remove-Item -Force -Path $DestLocation -ErrorAction Ignore
    return $true
}

# Check if Metabase is installed locally for building drivers; install it if not
function Install-MetabaseCore() {
    $UserDir = $M2

    try {
        $Result = Get-ChildItem -Path "$UserDir\.m2\repository\metabase-core\metabase-core" -Include '*.jar' -Recurse -ErrorAction Stop
        if (!$Result -or $Result.length -eq 0) {
            Write-Host "Building and installing jar locally"
            lein clean
            lein install-for-building-drivers
            return $true;
        }
        else {
            Write-Host "metabase-core already installed to local Maven repo."
            return $true
        }
    }
    catch {
        Write-Host "Building and installing jar locally"
        lein clean
        lein install-for-building-drivers
        return $true;
    }
    Write-Host "Failed to install metabase core."
    return $false
}


# Build Metabase uberjar if needed, we'll need this for stripping duplicate classes
function Build-MetabaseJar() {
    Param(
        $MetabaseUberjar
    )
    if (!(Test-Path $MetabaseUberjar)) {
        Write-Host "Building Metabase uberjar..."
        lein uberjar
        return $true
    }
    else {
        Write-Host "Metabase uberjar alrady built"
        return $true
    }
    return $false
}

# Take a look at the `parents` file listing the parents to build, if applicable
function Build-Parents () {
    Param(
        $ProjectRoot,
        $DriverProjectDir
    )
    Write-Host "Building parent drivers (if needed)..."
    $ParentListFile = "$DriverProjectDir\parents"
    if (! (Test-Path -Path $ParentListFile)) {
        return @()
    }
    $FileContent = Get-Content -Path $ParentListFile
    $Parents = @()
    foreach ($Parent in $FileContent) {
        $Parents += $Parent
        $ParentJarFile = "resources\modules\$($Parent).metabase-driver.jar"
        if (! (Test-Path -Path $ParentJarFile)) {
            Write-Host "Building $Parent"
            Build-Driver -Driver $Parent
        }

        # Check whether built parent driver *JAR* exists in local maven repo
        $UserDir = $M2
        $ParentInstallDir = "$UserDir\.m2\repository\metabase\$($Parent)-driver"
        $ParentInstalledJar = $null

        if (Test-Path $ParentInstallDir) {
            $ParentInstalledJar = Get-ChildItem -Path $ParentInstallDir -Include "*.jar" -Recurse -ErrorAction Ignore
        }

        if (!$ParentInstalledJar -or $ParentInstalledJar.length -eq 0) {
            $ParentProjectDir = "$ProjectRoot\modules\drivers\$Parent"
            Write-Host "Installing $Parent locally..."
            Set-Location -Path $ParentProjectDir
            lein clean
            lein install-for-building-drivers
            Set-Location -Path $ProjectRoot
        }
        else {
            Write-Host "$Parent already installed to local Maven repo."
        }
    }
    return $Parents
}

# Build the driver uberjar itself
function Build-DriverUberJar {
    param (
        $ProjectRoot,
        $Driver,
        $DriverProjectDir,
        $TargetJar`
    )
    Write-Host "Building $Driver"

    Set-Location $DriverProjectDir

    Remove-Item -Path ".\target" -Force -Recurse -ErrorAction Ignore

    lein clean
    $env:DEBUG = "1"
    $env:LEIN_SNAPSHOTS_IN_RELEASE = "true"
    lein uberjar

    Set-Location $ProjectRoot

    if (!(Test-Path -Path $TargetJar)) {
        Write-Error "Error: could not find $TargetJar. Build failed."
        return $false
    }
    else {
        return $true
    }
    return $false
}

# Strip out any classes in driver JAR found in core Metabase uberjar or parent JARs; recompress with higher compression ratio
function Strip-Compress () {
    Param(
        $Parents,
        $TargetJar
    )
    try {
        # strip out any classes found in the core Metabase uberjar
        $LeinCmd = "lein strip-and-compress $TargetJar"
        Invoke-Expression -Command $LeinCmd -ErrorAction Stop

        # Next, remove any classes found in any of the parent jar

        foreach ($Parent in $Parents) {
            Write-Host "Removing duplicate classes with $Parent uberjar..."
            $LeinCmd = "lein strip-and-compress $TargetJr resources\modules\$($Parent).metabase-driver.jar"
            Invoke-Expression $LeinCmd -ErrorAction Stop
        }
        return $true
    }
    catch {
        return $false
    }
}

# Copy that JAR in the resources dir
function CopyTargetTo-Dest () {
    Param(
        $TargetJar,
        $DestLocation
    )
    Write-Host "Copying $Targetjar to $DestLocation"
    try {
        Move-Item -Path $TargetJar -Destination $DestLocation -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# check that JAR in resources dir looks correct
function Verify-Build () {
    param(
        $Driver,
        $ChecksumFile,
        $TargetJar,
        $DestLocation
    )
    $VerificationStatus = Verify-Driver -Driver $Driver
    if (!$VerificationStatus) {
        Write-Host "Build $Driver FAILED."
        Remove-Item -Force -Path $ChecksumFile -ErrorAction Ignore
        Remove-Item -Force -Path $TargetJar -ErrorAction Ignore
        Remove-Item -Force -Path $DestLocation -ErrorAction Ignore
        return $false
    }
    return $true
}

function Calculate-Checksum {
    param (
        $DriverProjectDir
    )
    $TempCombinedFile = ".\.combinedContent"
    Get-ChildItem  -Path $DriverProjectDir -Include "*.clj"
    Get-ChildItem  -Path $DriverProjectDir -Include "*.clj" -Recurse -ErrorAction Stop | Sort-Object | ForEach-Object {
        $content = Get-Content $_.FullName;
        $content | Out-File -FilePath $TempCombinedFile -Append
    }
    Get-ChildItem -Path $DriverProjectDir -Include "*.yaml" -Recurse -ErrorAction Stop | Sort-Object | ForEach-Object {
        $content = Get-Content $_.FullName;
        $content | Out-File -FilePath $TempCombinedFile -Append
    }
    $checksum = Get-FileHash -Path $TempCombinedFile -Algorithm MD5
    Remove-Item -Path $TempCombinedFile -Force -ErrorAction Stop
    return $checksum.hash
}


# Save the checksum for the newly built JAR
function Save-Checksum() {
    param(
        $DriverProjectDir,
        $ChecksumFile
    )
    Write-Host "Saving checksum for source files to $ChecksumFile"
    $Cheksum = Calculate-Checksum -DriverProjectDir $DriverProjectDir
    $Cheksum | Out-File -FilePath $ChecksumFile -Encoding utf8 -ErrorAction Stop
    return $true
}

function Checksum-IsSame() {
    param(
        $DriverProjectDir,
        $ChecksumFile,
        $TargetJar,
        $Driver
    )
    if ((Test-Path $ChecksumFile)) {
        $OldChecksum = Get-Content -Path $ChecksumFile
        $CurrentChecksum = Calculate-Checksum -DriverProjectDir $DriverProjectDir
        Write-Host "Checksum of source files for previous build: $OldChecksum"
        Write-Host "Current checksum of source files: $CurrentChecksum"
        if ($OldChecksum -eq $CurrentChecksum) {
            if ((Test-Path -Path $TargetJar)) {
                Write-Host "$Driver driver source unchanged since last build. Skipping re-build."
                return $true
            }
        }
    }
    return $false
}

function Clean-LocalRepo {
    Write-Host "Deleting existing installed metabase-core and driver dependencies..."
    $UserDir = $M2
    Remove-Item -Recurse -Force -Path "$Userdir\.m2\repository\metabase-core" -ErrorAction Ignore
    Remove-Item -Recurse -Force -Path "$Userdir\.m2\repository\*-driver" -ErrorAction Ignore
    Get-ChildItem "$Userdir\.m2\repository\metabase" -ErrorAction Ignore | Where { $_.Name -Match ".*-driver" } | Remove-Item -Force -Recurse -ErrorAction Stop
}

function Build-DriverPipeline () {
    Param(
        $Driver,
        $DriverProjectDir,
        $DriverJar,
        $DestLocation,
        $MetabaseUberJar,
        $TargetJar,
        $ChecksumFile,
        $ProjectRoot
    )
    try {
        #$Result = $true
        Verify-ExistingBuild -Driver $Driver -ChecksumFile $ChecksumFile
        $Result = $true -and (Delete-OldDrivers -Driver $Driver -DriverJar $DriverJar -DestLocation $DestLocation)
        $Result = $Result -and (Install-MetabaseCore)
        $Result = $Result -and (Build-MetabaseJar -MetabaseUberjar $MetabaseUberJar)
        $Parents = Build-Parents -ProjectRoot $ProjectRoot -DriverProjectDir $DriverProjectDir
        $Result = $Result -and (Build-DriverUberJar -ProjectRoot $ProjectRoot -Driver $Driver -DriverProjectDir $DriverProjectDir -TargetJar $TargetJar)
        $Result = $Result -and (Strip-Compress -Parents $Parents -TargetJar $TargetJar)
        $Result = $Result -and (CopyTargetTo-Dest -TargetJar $TargetJar -DestLocation $DestLocation)
        $Result = $Result -and (Verify-Build -Driver $Driver -ChecksumFile $ChecksumFile -TargetJar $TargetJar -DestLocation $DestLocation)
        $Result = $Result -and (Save-Checksum -DriverProjectDir $DriverProjectDir -ChecksumFile $ChecksumFile)
        Write-Host $Result
        return $Result
    }
    catch {
        return @($false, $false)
    }
}
function Build-Driver () {
    Param(
        $Driver
    )
    $ProjectRoot = Get-Location
    $DriverProjectDir = "$ProjectRoot\modules\drivers\$Driver"
    $DriverJar = "$Driver.metabase-driver.jar"
    $DestLocation = "$ProjectRoot\resources\modules\$DriverJar"
    $MetabaseUberJar = "$ProjectRoot\target\uberjar\metabase.jar"
    $TargetJar = "$DriverProjectDir\target\uberjar\$DriverJar"
    $Parents = ""
    $ChecksumFile = "$DriverProjectDir\target\checksum.txt"

    if (!(Checksum-IsSame -DriverProjectDir $DriverProjectDir -ChecksumFile $ChecksumFile -TargetJar $TargetJar -Driver $Driver )) {
        Write-Host "Checksum has changed."
        $Result = Build-DriverPipeline -DriverProjectDir $DriverProjectDir -Driver $Driver -ProjectRoot $ProjectRoot -DriverJar $DriverJar -DestLocation $DestLocation -MetabaseUberJar $MetabaseUberjar -TargetJar $TargetJar -ChecksumFile $ChecksumFile
        if (!$Result[0]) {
            return Retry -Driver $Driver -ProjectRoot $ProjectRoot -DriverJar $DriverJar -Destination $DestLocation -MetabaseUberJar $MetabaseUberjar -TargetJar $TargetJar -ChecksumFile $ChecksumFile
        }
        else {
            return $Result[0]
        }
    }
    else {
        Write-Host "checksum is unchanged"
        $result = CopyTargetTo-Dest -TargetJar $TargetJar -DestLocation $DestLocation
        $result2 = Verify-Build -Driver $Driver -ChecksumFile $ChecksumFile -TargetJar $TargetJar -DestLocation $DestLocation
        $result = $result -and $result2
        if (!$result) {
            return Retry -DriverProjectDir $DriverProjectDir -Driver $Driver -ProjectRoot $ProjectRoot -DriverJar $DriverJar -Destination $DestLocation -MetabaseUberJar $MetabaseUberjar -TargetJar $TargetJar -ChecksumFile $ChecksumFile
        }
        else {
            return $result
        }
    }
}

function Retry() {
    param (
        $Driver,
        $DriverProjectDir,
        $DriverJar,
        $DestLocation,
        $MetabaseUberJar,
        $TargetJar,
        $ChecksumFile,
        $ProjectRoot
    )
    Write-Host "Building without cleaning failed. Retrying clean build..."
    Clean-LocalRepo
    $Result = Build-DriverPipeline -DriverProjectDir $DriverProjectDir -Driver $Driver -ProjectRoot $ProjectRoot -DriverJar $DriverJar -Destination $DestLocation -MetabaseUberJar $MetabaseUberjar -TargetJar $TargetJar -ChecksumFile $ChecksumFile
    return $Result[0]
}

mkdir -Path "resources\modules" -ErrorAction Ignore
$Drivers = Get-ChildItem -Directory  -Path "modules\drivers"  -Name
$DriversToBuild = @{
    "google"          = 1;
    "googleanalytics" = 1;
    "sqlite"          = 1;
    "sqlserver"       = 1;
};
Clean-LocalRepo
foreach ($Driver in $Drivers) {
    if ($DriversToBuild.Contains($Driver)) {
        Write-Host "Build: $Driver"
        $result = Build-Driver -Driver $Driver
        if (!$result) {
            throw "Failed to build driver $Driver"
        }
    }
}
