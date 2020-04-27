(ns metabase.util.xlsx
  (:import
   (java.io File FileOutputStream OutputStream)
   (java.util Date Calendar)
   (org.apache.poi.xssf.streaming SXSSFWorkbook)
   (org.apache.poi.ss.usermodel Workbook Sheet Cell Row)))

(defn ^:dynamic create-date-format
  [^Workbook workbook ^String format]
  (let [data-style (.createCellStyle workbook)
        format-helper (.getCreationHelper workbook)]
    (doto data-style
      (.setDataFormat (.. format-helper createDataFormat (getFormat format))))))

(defmulti set-cell!
  (fn [^Cell cell val] (type val)))

(defmethod set-cell! String
  [^String cell val]
  (.setCellValue cell ^String val))

(defmethod set-cell! Number
  [^Cell cell val]
  (.setCellValue cell (double val)))

(defmethod set-cell! Boolean
  [^Cell cell val]
  (.setCellValue cell ^Boolean val))

(defmethod set-cell! Date
  [^Cell cell val]
  (.setCellValue cell ^Date val)
  (.setCellStyle cell (create-date-format (.. cell getSheet getWorkbook) "m/d/yyyy")))

(defmethod set-cell! nil
  [^Cell cell val]
  (.setBlank cell))

(defmethod set-cell! :default
  [^Cell cell val]
  (.setCellValue (.toString val)))

(defn add-row!
  [^Sheet sheet  values]
  (let [row-num (if (= 0 (.getPhysicalNumberOfRows sheet))
                  0
                  (inc (.getLastRowNum sheet)))
        row (.createRow sheet row-num)]
    (doseq [[col-idx val] (map-indexed #(list %1 %2) values)]
      (set-cell! (.createCell row col-idx) val))
    row))

(defn add-rows!
  [^Sheet sheet rows]
  (binding [create-date-format (memoize create-date-format)]
    (doseq [row rows]
      (add-row! sheet row))))

(defn add-sheet!
  [^Workbook workbook name]
  (.createSheet workbook name))

(defn dispose-workbook
  [^SXSSFWorkbook workbook]
  (.dispose workbook))

(defn create-workbook
  [sheet-name data]
  (let [workbook (SXSSFWorkbook. 800)
        sheet (add-sheet! workbook sheet-name)]
    ;(.setCompressTempFiles workbook true)
    (try
      (add-rows! sheet data)
      (catch Throwable e
        (dispose-workbook workbook)))
    workbook))


(defn save-workbook-into-stream!
  [stream workbook]
  (.write workbook stream))

(defn save-workbook-into-file!
  [filename workbook]
  (with-open [fileStream (FileOutputStream. filename)]
    (save-workbook-into-stream! fileStream workbook)))

(defmulti save-workbook!
  (fn [x _] (class x)))

(defmethod save-workbook! OutputStream
  [stream workbook]
  (save-workbook-into-stream! stream workbook))

(defmethod save-workbook! String
  [filename workbook]
  (save-workbook-into-file! filename workbook))
