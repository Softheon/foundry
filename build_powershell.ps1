
	Set-Location $PSScriptRoot
	echo "Tagging uberjar with version"
	$TAG="tag=v0.29.3"
	$HASH=git show-ref --head --hash=7 head | Out-String
	$BRANCH=git rev-parse --abbrev-ref HEAD | Out-String
	$DATE=git log -1 --pretty=%ad --date=short | Out-String
	$VERSIONPROPERTIESFILES="resources/version.properties"

	Remove-Item -Path $VERSIONPROPERTIESFILES -ErrorAction Ignore
	$HASH="hash=${HASH}"
	$BRANCH="branch=${BRANCH}"
	$DATE="date=${DATE}"
	$TAG.Trim() -replace  "`n|`r" | Out-File $VERSIONPROPERTIESFILES -Append
	$HASH.Trim() -replace  "`n|`r" | Out-File $VERSIONPROPERTIESFILES -Append
	$BRANCH.Trim() -replace  "`n|`r" | Out-File $VERSIONPROPERTIESFILES -Append
	$DATE.Trim() -replace  "`n|`r" | Out-File $VERSIONPROPERTIESFILES -Append

	echo "Running 'yarn' to download javascript dependencies..." 
	yarn install --production=false
	echo "Running 'webpack' with NODE_ENV=production assemble and minify frontend assets..." 
    $env:NODE_ENV="production"
	./node_modules/.bin/webpack --bail


	$SAMPLEDATASET="resources/sample-dataset.db.mv.db"
	$HASSAMPLEDATASET= Test-Path $SAMPLEDATASET
	if(!$HASSAMPLEDATASET){
		echo "Running 'lein generate-sample-dataset' to generate the sample dataset..."
		 lein generate-sample-dataset  
	}else{
		echo "Sample Dataset already generated."
	}

	echo "Running 'lein uberjar'..."
	lein uberjar
