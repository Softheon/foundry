(ns metabase.util.xlsx
  (:import
   (java.io File FileOutputStream OutputStream)
   (java.awt Color)
   (java.util Date Calendar)
   (org.apache.poi.xssf.streaming SXSSFWorkbook)
   (org.apache.poi.ss.util CellRangeAddress)
   (org.apache.poi.xssf.usermodel XSSFColor)
   (org.apache.poi.ss.usermodel Workbook Sheet Cell Row CellType FillPatternType PageOrder BorderStyle IndexedColors))
  (:require [clojure.string :as string]
            [clojure.tools.logging :as log]))


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
  (.setCellValue cell ""))

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
        xsff-wb (.getXSSFWorkbook workbook)
        sheet (add-sheet! workbook sheet-name)]
    (-> xsff-wb
        (.getProperties)
        (.getCoreProperties)
        (.setCreator "Foundry"))
    (try
      (add-rows! sheet data)
      (catch Throwable e
        (dispose-workbook workbook)
        (throw e)))
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


;=====================================================================================================================
;; printable excel
;=====================================================================================================================

(defn- update-max-column-width
  [index value columns-width]
  (swap! columns-width (fn [original]
                         (assoc original index (max
                                                (count (.toString value))
                                                (get original index))))))

(defmulti set-printable-cell!
  (fn [cell _ val _ _] (type val)))

(defmethod set-printable-cell! String
  [cell idx val style columns-width]
  (.setCellValue cell ^String val)
  (update-max-column-width idx val columns-width))

(defmethod set-printable-cell! Double
  [cell idx val style columns-width]
  (.setCellValue cell (double val))
  (update-max-column-width idx val columns-width))

(defmethod set-printable-cell! Boolean
  [cell idx val style columns-width]
  (.setCellValue cell ^Boolean val)
  (update-max-column-width idx val columns-width))

(defmethod set-printable-cell! Date
  [cell idx val style columns-width]
  (if  (contains? style :cell-style)
    (.setCellStyle cell (:cell-style style))
    (.setCellStyle cell (:date style)))
  (.setCellValue cell ^Date val)
  (update-max-column-width idx val columns-width))


(defmethod set-printable-cell! java.math.BigDecimal
  [cell idx val style columns-width]
  (when (map? style)
    (.setCellStyle cell (:money style)))
  (.setCellValue cell (double val))
  (update-max-column-width idx val columns-width))


(defmethod set-printable-cell! nil
  [cell idx val style columns-width]
  (.setCellValue cell ""))

(defmethod set-printable-cell! :default
  [cell idx val style columns-width]
  (.setCellValue cell (.toString val))
  (update-max-column-width idx val columns-width))

(defn- set-header-cell!
  [cell val style]
  (.setCellStyle cell style)
  (.setCellValue cell (.toString val)))

(defn- next-row-number
  [sheet]
  (if (= 0 (.getPhysicalNumberOfRows sheet))
    0
    (inc (.getLastRowNum sheet))))

(defn- add-printable-column-headers
  [wb sheet headers]
  (let [cell-style (.createCellStyle wb)
        row-num (next-row-number sheet)
        row (.createRow sheet row-num)
        font (.createFont wb)]
    (.setBold font true)
    (.setBorderBottom  cell-style BorderStyle/MEDIUM)
    (.setBorderTop cell-style BorderStyle/MEDIUM)
    (.setTopBorderColor  cell-style (.getIndex IndexedColors/BLACK))
    (.setBottomBorderColor  cell-style (.getIndex IndexedColors/BLACK))
    (.setWrapText cell-style true)
    (.setFont cell-style font)
    (doseq [[col-idx val] (map-indexed #(list %1 %2) headers)]
      (set-header-cell! (.createCell row col-idx) val cell-style))))

(defn- add-printable-data-row
  ([sheet values styles columns-width]
   (let [row-num (next-row-number sheet)
         row (.createRow sheet row-num)]
     (doseq  [[col-idx val] (map-indexed #(list %1 %2) values)]
       (set-printable-cell! (.createCell row col-idx) col-idx val (get styles col-idx)  columns-width)))))

(defn ^:dynamic create-format
  [^Workbook workbook ^String format]
  (let [data-style (.createCellStyle workbook)
        format-helper (.getCreationHelper workbook)]
    (doto data-style
      (.setDataFormat (.. format-helper createDataFormat (getFormat format))))))

(defn- cell-style-map
  [wb]
  {:date  (create-format wb "m/d/yyyy")
   :time (create-format wb "h:mm:ss AM/PM")
   :datetime (create-format wb "m/d/yyyy h:mm:ss AM/PM")
   :dollar (create-format wb "$#,#0.00")})

(defn- get-data-cell-style
  [styles header]
  (cond
    (re-find #"(?i)(^date\s+\S*|^date$|\S*\s+date$|\S*\s+date\s+\S*)"  header) {:cell-style (:date styles)}
    (re-find #"(?i)(^time\s+\S*|^time$|\S*\s+time$|\S*\s+time\s+\S*)" header)  {:cell-style (:time styles)}
    (re-find #"(?i)(^datetime\s+\S*|^datetime$|\S*\s+datetime$|\S*\s+datetime\s+\S*)" header)  {:cell-style (:datetime styles)}
    (re-find #"(?i)(^dollar\s+\S*|^dollar$|\S*\s+dollar$|\S*\s+dollar\s+\S*)" header) {:cell-style (:dollar styles)}
    :else {:money (:dollar styles)
           :date (:date styles)}))

(defn- add-printable-data-rows
  [sheet column-names data-rows columns-width]
  (let [pre-defined-cell-styles (cell-style-map (.getWorkbook sheet))
        styles (into
                []
                (map (partial get-data-cell-style pre-defined-cell-styles) column-names))]
    (doseq [row data-rows]
      (add-printable-data-row sheet row styles columns-width))))

(defn- add-sheet-header
  [sheet header-detail]
  (let [{:keys [left right middle]} header-detail
        header (.getHeader sheet)]
    (.setLeft header left)
    (.setCenter header middle)
    (.setRight header right)
    header))

(defn- add-sheet-footer
  [sheet {:keys [left right]}]
  (let [footer (.getFooter sheet)]
    (.setLeft footer left)
    (.setRight footer right)
    footer))

(defn- apply-printable-sheet-styles
  [sheet {:keys [header footer column-width enable-column-auto-sizing]
          :or {column-width 12
               enable-column-auto-sizing false}
          :as style}]
  (.createFreezePane sheet 0 1)
  (when enable-column-auto-sizing
    (.trackAllColumnsForAutoSizing sheet))
  (add-sheet-header  sheet header)
  (add-sheet-footer  sheet footer)
  (.setDefaultColumnWidth sheet column-width)
  (.setPrintGridlines sheet true)
  (.setFitToPage sheet true)
  (.setHorizontallyCenter sheet true)
  (.setMargin sheet Sheet/LeftMargin 0.5)
  (.setMargin sheet  Sheet/RightMargin 0.5)
  (.setMargin sheet  Sheet/TopMargin 0.85)
  (.setMargin sheet  Sheet/BottomMargin 0.60)
  (.setMargin sheet  Sheet/HeaderMargin 0.25)
  (.setMargin sheet  Sheet/FooterMargin 0.2)
  (let [print-setup (.getPrintSetup sheet)]
    (.setLandscape print-setup true)
    (.setPageOrder print-setup PageOrder/OVER_THEN_DOWN)
    (.setFitWidth print-setup 2)
    (.setFitHeight print-setup 32000))
  (.setRepeatingRows sheet (CellRangeAddress/valueOf "1:1")))

(defn- join-params-str
  [result params]
  (str result
       (reduce (fn [result [key value]] (str result  key ":" value ","))
               ""
               params)
       "\n"))

(defn- params-string
  [params, number-param-per-line]
  (if (= 0 (count params))
    ""
    (let [params-array (reduce (fn [result [k v]] (conj result [k v]))
                               []
                               params)]
      (loop [result ""
             current params-array]
        (let [firstN  (take number-param-per-line current)
              rest (drop number-param-per-line current)]
          (if (= 0  (count firstN))
            result
            (recur (join-params-str result firstN) rest)))))))

(defn- add-printable-sheet-data
  [wb sheet column-headers records columns-width-atom]
  (add-printable-column-headers wb sheet column-headers)
  (add-printable-data-rows sheet column-headers records columns-width-atom))

(defn- make-column-content-visibile
  [sheet default-width columns-width]
  (doall
   (map-indexed
    (fn [idx val]
      (when (> val default-width)
        (.autoSizeColumn sheet idx)))
    @columns-width)))

(defn- drop-last-n-character
  [str n]
  (if (>= n (count str))
    ""
    (.substring (java.lang.String. str) 0 (- (count str) n))))


(defn- add-printable-sheet
  [wb {:keys [sheet-name data author title params styles enable-column-auto-sizing]
       :or {params {} styles {} enable-column-auto-sizing false}
       :as report-detail}]
  (let [column-headers (first data)
        records (rest data)
        sheet (add-sheet! wb sheet-name)
        column-count  (count column-headers)
        default-column-width (:column-width styles 12)
        columns-width (atom (into [] (take column-count (repeat default-column-width))))
        formatted-params-str (params-string params 2)]
    (apply-printable-sheet-styles sheet {:header {:left author
                                                  :middle title
                                                  :right (drop-last-n-character formatted-params-str 2)}
                                         :footer {:left "Printed &D &T"
                                                  :middle ""
                                                  :right "&P of &N"}
                                         :column-width default-column-width
                                         :enable-column-auto-sizing enable-column-auto-sizing})
    (add-printable-sheet-data wb sheet column-headers records columns-width)
    (when enable-column-auto-sizing
      (make-column-content-visibile sheet default-column-width columns-width))))

(defn- create-printable-workbook
  [{:keys [author title params] :or {params {}} :as props}]
  (let [report-params (params-string params 1)
        wb (SXSSFWorkbook. (:window-size props 800))
        current-date (Date.)
        core-properties (.. wb (getXSSFWorkbook) (getProperties) (getCoreProperties))
        extended-properties (.. wb (getXSSFWorkbook) (getProperties) (getExtendedProperties))]
    (.setCreator core-properties "Foundry")
    (.setKeywords core-properties "Foundry")
    (.setTitle core-properties (str title " by " author " on "
                                    (.format (java.text.SimpleDateFormat. "MM-dd-yyyy") current-date)))
    (.setDescription core-properties (str "Run by:" author "\n"
                                          "Run on:" (.format (java.text.SimpleDateFormat. "MMM-dd-yyyy") current-date) "\n"
                                          "Report Parameters: \n"
                                          (string/replace report-params "," "")))
    (.setApplication (.getUnderlyingProperties extended-properties) "Foundry")
    wb))

(defn printable-workbook
  [report-detail]
  (let [workbook (create-printable-workbook report-detail)]
    (add-printable-sheet workbook report-detail)
    workbook))

(defn export-printable-excel!
  "
   (def report-detail 
   {
   :path \"report.xlsx\"
   :sheet-name \"Sheet1\"
   :author \"author\"
   :title \"Reporting\"
   :styles {:column-width 12}
   :params {\"Start-Date\" \"9/15/2021\"
            \"End-Date\" \"10/6/2021\"
            }
   :data [[column-1-name column-2-name] 
          [column-1-value column-2-vallue]]})
   
   (ex[prt-printable-excel! report-dataol])
   "
  [report-detail]
  (let [workbook (create-printable-workbook report-detail)
        path (str (:title report-detail)  " by " (:author report-detail) " on "
                  (.format (java.text.SimpleDateFormat. "MM-dd-yyyy") (Date.))
                  ".xlsx")
        path (.replaceAll path "[\\\\/:*?\"<>|]"  "_")]
    (try
      (add-printable-sheet workbook report-detail)
      (save-workbook! path workbook)
      path
      (finally
        (dispose-workbook workbook)))))

;=====================================================================================================================
;; excel file with conditional formatting
;=====================================================================================================================

(defn add-header
  [sheet header-names]
  (let [row (.createRow sheet 0)]
    (doseq [[column-index value] (map-indexed #(list %1 %2) header-names)]
      (set-cell! (.createCell row column-index) value))))

(defn get-cell-color
  [formatters value]
  (some (fn [current-formatter]
          (current-formatter value)) formatters))

(defn get-highlighted-cell-value
  [formatters data]
  (loop [index 0]
    (if (>= index (count formatters))
      nil
      (let [cell-formatters (get formatters index)
            column-value (get data index)
            color (some (fn [cell-formatter]
                          (let [result (cell-formatter column-value)]
                            (and result (:highlight-row result) result)))
                        cell-formatters)]
        (if color
          color
          (recur (inc index)))))))

(defn update-cell-color
  [cell cell-style color-hex-code brighter]
  (let [color (Color/decode color-hex-code)
        cell-color (if brighter (.brighter color) color)
        xssf-color (XSSFColor. cell-color)]
    (.setFillForegroundColor cell-style (XSSFColor/toXSSFColor xssf-color))
    (.setFillPattern cell-style  FillPatternType/SOLID_FOREGROUND)
    (.setCellStyle cell cell-style)))

(defn add-formatted-data-row
  [sheet data formatters]
  (let [row-num (if (= 0 (.getPhysicalNumberOfRows sheet))
                  0
                  (inc (.getLastRowNum sheet)))
        row (.createRow sheet row-num)
        workbook (.getWorkbook sheet)]
    (doseq [[col-idx val] (map-indexed #(list %1 %2) data)]
      (let [new-cell (.createCell row col-idx)
            column-formatters (get formatters col-idx)
            default-color (get-highlighted-cell-value formatters data)]
        (if column-formatters
          (let [cell-color (get-cell-color column-formatters val)]
            (if (:color cell-color)
              (update-cell-color new-cell (.createCellStyle workbook) (:color cell-color) false)
              (when default-color
                (update-cell-color new-cell (.createCellStyle workbook) (:color default-color) true))))
          (when default-color
            (update-cell-color new-cell (.createCellStyle workbook) (:color default-color) true)))

        (set-cell! new-cell val)))
    row))

(defn create-workbook-with-colulm-formatting
  [sheet-name data column-formatters]
  (let [workbook (SXSSFWorkbook. 500)
        xsff-wb (.getXSSFWorkbook workbook)
        sheet (add-sheet! workbook sheet-name)]
    (-> xsff-wb
        (.getProperties)
        (.getCoreProperties)
        (.setCreator "Foundry"))
    (try
      (add-header sheet (first data))
      (doseq [row (rest data)]
        (add-formatted-data-row sheet row column-formatters))
      (catch Throwable e
        (dispose-workbook workbook)
        (throw e)))
    workbook))