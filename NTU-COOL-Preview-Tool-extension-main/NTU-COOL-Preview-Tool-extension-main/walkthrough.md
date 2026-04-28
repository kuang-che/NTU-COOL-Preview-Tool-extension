# 專案優化總結報告 (Phase 1 ~ Phase 3)

我們已經順利完成了針對 NTU COOL Text File Previewer 的三階段優化與功能擴充。

---

## Phase 1 修正：安全性與程式碼可維護性

### 1. 解決 XSS 資安漏洞 (Security Patch)
- 我們實作了 `escapeHTML` 函式，並在解析 ZIP/TGZ 壓縮檔的檔案結構以及解析 Excel 工作表名稱時，將檔名與工作表名進行跳脫處理。這確保了遇到惡意命名的檔案時，不會在預覽視窗內觸發跨站腳本攻擊 (XSS)。

### 2. 提升程式碼可維護性 (Refactoring)
- **解耦合**：我們建立了兩個獨立的 JavaScript 檔案：
  - `js/archive_parser.js`：專責處理 ZIP 與 TGZ 壓縮檔的解析與渲染。
  - `js/excel_parser.js`：專責處理 Excel 檔案的表格渲染。
- **清除臃腫字串**：在 `content.js` 中，移除了原本極難閱讀且長達百字的行內解析腳本字串，改為動態引入上述的解析腳本。未來若要修改預覽畫面或新增功能，將變得非常容易。

### 3. 效能優化 (Performance Optimization)
- 為 `MutationObserver` 實作了 **Debounce (防抖)** 機制。由於 NTU COOL / Canvas 平台會頻繁地更新 DOM，先前的實作會導致 `injectPreviewButtons()` 不斷被執行。現在我們將觸發頻率限制在每 300 毫秒最多執行一次，大幅減輕了瀏覽器運算的負擔，改善了頁面瀏覽體驗。

---

## Phase 2 修正：壓縮檔內容內部預覽

我們實作了讓使用者點擊樹狀結構即可預覽壓縮檔內容的功能。

### 新增功能與 UI 修改

1. **雙欄式預覽介面 (Split View)**：
   我們將壓縮檔 (`.zip`, `.tgz`, `.gz`) 的預覽視窗改為左右分割的版面配置。左側顯示目錄樹狀結構，右側為內容預覽區，支援即時預覽文字與圖片。

2. **檔案動態萃取與預覽**：
   * **ZIP 檔**：點擊檔案時，會動態呼叫 `JSZip` 來解碼單一檔案。
   * **TGZ 檔**：點擊檔案時，系統利用記錄好的偏移量 (`offset`) 與大小 (`size`) 切割出檔案資料，達到近乎瞬間載入單檔的效能體驗。
   
3. **內嵌語法高亮 (Syntax Highlighting)**：
   為內部文字檔案提供程式碼語法高亮的效果。

---

## Phase 3 新增：Jupyter Notebook (.ipynb) 支援

我們新增了對於資料科學/程式設計作業最常使用的 Jupyter Notebook 格式的完美支援。

1. **Notebook 原生排版還原**：
   * **Markdown 儲存格**：透過 `Marked.js` 重新渲染成格式化的文字（支援標題、程式碼區塊、粗體等）。
   * **程式碼儲存格**：還原 `In [ ]:` 提示字元，並針對 Python 語法使用 `Highlight.js` 高亮顯示。

2. **完整輸出結果 (Outputs) 支援**：
   * 支援顯示一般的 `stream` 文字輸出與錯誤訊息 (Traceback)。
   * **圖表支援**：能將輸出中內嵌的 `image/png` 與 `image/jpeg` 靜態圖表原汁原味地繪製在畫面上。
   * **安全降級**：基於資安考量，會將可能含有惡意腳本的 `text/html` 表格輸出，自動降級為純文字 `text/plain` 呈現，防止 XSS 攻擊。

3. **擴充設定面板**：
   在彈出設定頁面 (`popup.html`) 中新增了對應的欄位，讓使用者可以自訂 `.ipynb` 觸發的副檔名條件。
