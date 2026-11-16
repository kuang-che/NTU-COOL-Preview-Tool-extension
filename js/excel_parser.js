// Excel 預覽。
// .xlsx：用 ExcelJS 讀取，保留底色、字型、框線、對齊、合併儲存格、欄寬與列高。
// .xls 或 ExcelJS 失敗時：退回 SheetJS 的純表格輸出（沒有樣式）。
(function () {
    const MAX_ROWS = 3000, MAX_COLS = 200;
    // 只能用單引號：這串會放進 style="..." 屬性裡
    const DEFAULT_FONT = "Calibri, 'Microsoft JhengHei', 'PingFang TC', sans-serif";
    const GRID = '1px solid #d4d4d4';

    const esc = (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    // ---- 顏色 ----
    // Office 預設佈景主題；若活頁簿內有自己的主題會覆蓋。索引順序為 Excel 的 theme 編號（0=lt1, 1=dk1, 2=lt2, 3=dk2, 4~9=accent1~6）
    let themeColors = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72'];

    function loadTheme(workbook) {
        const xml = workbook._themes && Object.values(workbook._themes)[0];
        if (typeof xml !== 'string') return;
        const pick = (name) => {
            const m = xml.match(new RegExp('<a:' + name + '>[\\s\\S]*?(?:srgbClr val|lastClr)="([0-9A-Fa-f]{6})"'));
            return m && m[1];
        };
        // XML 內的順序是 dk1, lt1, dk2, lt2；theme 編號則是 lt1, dk1, lt2, dk2
        ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
            .forEach((name, i) => { const c = pick(name); if (c) themeColors[i] = c; });
    }

    function applyTint(hex, tint) {
        if (!tint) return hex;
        return [0, 2, 4].map(i => {
            const c = parseInt(hex.substr(i, 2), 16);
            const v = tint < 0 ? c * (1 + tint) : c + (255 - c) * tint;
            return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
        }).join('');
    }

    function cssColor(color) {
        if (!color) return null;
        if (color.argb) return '#' + String(color.argb).slice(-6);
        if (color.theme != null && themeColors[color.theme]) return '#' + applyTint(themeColors[color.theme], color.tint);
        if (color.indexed === 64) return '#000000';
        return null;
    }

    // ---- 儲存格內容 ----
    function formatNumber(n, numFmt) {
        if (numFmt && numFmt.includes('%')) {
            const decimals = (numFmt.split('.')[1] || '').replace(/[^0]/g, '').length;
            return (n * 100).toFixed(decimals) + '%';
        }
        if (numFmt && /^[#0,]*\.(0+)/.test(numFmt)) {
            const decimals = numFmt.match(/\.(0+)/)[1].length;
            return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: numFmt.includes(',') });
        }
        return String(parseFloat(n.toPrecision(12)));
    }

    function formatDate(d, numFmt) {
        const p = (x) => String(x).padStart(2, '0');
        const date = `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
        const time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
        const hasTime = d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds();
        if (numFmt && /h/i.test(numFmt) && !/[yd]/i.test(numFmt)) return time;
        return hasTime ? `${date} ${time}` : date;
    }

    // 公式取計算結果
    const valueOf = (cell) => { const v = cell.value; return v && typeof v === 'object' && 'result' in v ? v.result : v; };
    const isGeneral = (numFmt) => !numFmt || numFmt === 'General';

    function cellText(cell) {
        let v = cell.value;
        if (v == null) return '';
        if (typeof v === 'object' && !(v instanceof Date)) {
            if ('result' in v) v = v.result;                         // 公式
            else if (v.richText) return v.richText.map(r => r.text).join('');
            else if (v.text != null) return typeof v.text === 'object' && v.text.richText ? v.text.richText.map(r => r.text).join('') : String(v.text); // 超連結
            else if (v.error) return String(v.error);
            else if ('formula' in v || 'sharedFormula' in v) return '';
        }
        if (v == null) return '';
        if (v instanceof Date) return formatDate(v, cell.numFmt);
        if (typeof v === 'number') return formatNumber(v, cell.numFmt);
        if (typeof v === 'object') return v.error ? String(v.error) : '';
        return String(v);
    }

    // ---- 儲存格樣式 ----
    const BORDER_STYLES = { thin: '1px solid', hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed', dashDot: '1px dashed', dashDotDot: '1px dashed',
        medium: '2px solid', mediumDashed: '2px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dashed', slantDashDot: '2px dashed', thick: '3px solid', double: '3px double' };

    // edges：合併儲存格的右、下框線存在範圍最右／最下的那一格，由呼叫端傳入覆蓋
    function cellCss(cell, showGrid, edges) {
        const css = [], font = cell.font || {}, fill = cell.fill, border = Object.assign({}, cell.border, edges), align = cell.alignment || {};

        if (font.name) css.push(`font-family:'${String(font.name).replace(/['\\]/g, '')}',${DEFAULT_FONT}`);
        if (font.size) css.push(`font-size:${font.size}pt`);
        if (font.bold) css.push('font-weight:bold');
        if (font.italic) css.push('font-style:italic');
        const deco = [font.underline && font.underline !== 'none' ? 'underline' : '', font.strike ? 'line-through' : ''].filter(Boolean).join(' ');
        if (deco) css.push('text-decoration:' + deco);
        const fg = cssColor(font.color);
        if (fg) css.push('color:' + fg);

        if (fill && fill.type === 'pattern' && fill.pattern && fill.pattern !== 'none') {
            const bg = cssColor(fill.pattern === 'solid' ? fill.fgColor : (fill.bgColor || fill.fgColor));
            if (bg) css.push('background-color:' + bg);
        } else if (fill && fill.type === 'gradient' && fill.stops && fill.stops.length) {
            const stops = fill.stops.map(s => cssColor(s.color)).filter(Boolean);
            if (stops.length) css.push(`background:linear-gradient(${stops.join(',')})`);
        }

        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const b = border[side];
            if (b && b.style && BORDER_STYLES[b.style]) css.push(`border-${side}:${BORDER_STYLES[b.style]} ${cssColor(b.color) || '#000'}`);
            else if (showGrid) css.push(`border-${side}:${GRID}`);
        });

        const h = align.horizontal;
        if (h === 'center' || h === 'centerContinuous' || h === 'distributed') css.push('text-align:center');
        else if (h === 'right') css.push('text-align:right');
        else if (h === 'left' || h === 'justify' || h === 'fill') css.push('text-align:left');
        else {
            const v = valueOf(cell);
            if (typeof v === 'number' || v instanceof Date) css.push('text-align:right');
        }
        css.push('vertical-align:' + ({ top: 'top', middle: 'middle', distributed: 'middle', justify: 'middle' }[align.vertical] || 'bottom'));
        if (align.wrapText) css.push('white-space:pre-wrap;word-break:break-word');
        if (align.indent) css.push(`padding-left:${3 + align.indent * 9}px`);
        if (align.textRotation === 'vertical') css.push('writing-mode:vertical-rl;text-orientation:upright');

        return css.join(';');
    }

    // ---- 工作表 → HTML ----
    function sheetHtml(ws) {
        // 合併範圍可能延伸到沒有資料的欄列，要一起算進顯示範圍，否則合併格的右／下框線會被切掉
        const merges = Object.values(ws._merges || {}).map(m => m.model || m);
        const rowCount = Math.min(Math.max(ws.rowCount, ...merges.map(m => m.bottom)), MAX_ROWS);
        const colCount = Math.min(Math.max(ws.columnCount, ...merges.map(m => m.right)), MAX_COLS);
        if (!rowCount || !colCount) return '<div style="color:#888;">(空白工作表)</div>';
        const showGrid = !(ws.views && ws.views[0] && ws.views[0].showGridLines === false);

        // 合併儲存格：主儲存格記錄跨幅，其餘被涵蓋的格子跳過
        const span = {}, covered = {};
        merges.forEach(range => {
            const { top, left } = range;
            const bottom = Math.min(range.bottom, rowCount), right = Math.min(range.right, colCount);
            if (top > rowCount || left > colCount) return;
            span[top + ',' + left] = [bottom - top + 1, right - left + 1];
            for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) if (r !== top || c !== left) covered[r + ',' + c] = 1;
        });

        const defaultWidth = (ws.properties && ws.properties.defaultColWidth) || 8.43;
        const widths = [];
        let total = 0, cols = '';
        for (let c = 1; c <= colCount; c++) {
            const col = ws.getColumn(c);
            const px = widths[c] = col.hidden ? 0 : Math.round((col.width || defaultWidth) * 7 + 5);
            total += px;
            cols += `<col style="width:${px}px">`;
        }

        let rows = '';
        for (let r = 1; r <= rowCount; r++) {
            const row = ws.getRow(r);
            if (row.hidden) continue;
            const height = Math.round((row.height || (ws.properties && ws.properties.defaultRowHeight) || 15) * 4 / 3);
            // 先取出整列文字：判斷文字能否延伸到右邊時要知道鄰格是否為空（被合併涵蓋的格子視為有內容）
            const texts = [];
            for (let c = 1; c <= colCount; c++) texts[c] = covered[r + ',' + c] ? null : cellText(row.getCell(c));
            let tds = '';
            for (let c = 1; c <= colCount; c++) {
                const key = r + ',' + c;
                if (covered[key]) continue;
                const cell = row.getCell(c), s = span[key], text = texts[c], v = valueOf(cell), align = cell.alignment || {};
                const edges = s && {
                    right: (row.getCell(c + s[1] - 1).border || {}).right,
                    bottom: (ws.getRow(r + s[0] - 1).getCell(c).border || {}).bottom
                };
                // 同 Excel：儲存格內容超出欄寬時，
                // ・數字與日期不會延伸到鄰格：通用格式的數字改為較少位數，其餘顯示 ###（由 fitNumbers 在畫面出來後處理）
                // ・靠左的文字可延伸到右邊連續的空白格，遇到有內容的格子就截斷；其他情況直接在格線截斷
                let attrs = '', html = esc(text);
                if (typeof v === 'number' || v instanceof Date) {
                    attrs = typeof v === 'number' && isGeneral(cell.numFmt) ? ` data-fit="g" data-v="${v}"` : ' data-fit="h"';
                } else if (text && !s && !align.wrapText && !align.textRotation && (!align.horizontal || align.horizontal === 'left' || align.horizontal === 'general')) {
                    let room = widths[c], k = c + 1;
                    for (; k <= colCount && texts[k] === ''; k++) room += widths[k];
                    if (k > c + 1) {
                        attrs = ' class="xl-spill"';
                        // 右邊直到工作表最後一欄都是空的：不限寬度（Excel 會一直延伸下去）
                        html = `<span${k <= colCount ? ` style="max-width:${room - 6}px"` : ''}>${html}</span>`;
                    }
                }
                tds += `<td${s ? ` rowspan="${s[0]}" colspan="${s[1]}"` : ''}${attrs} style="${cellCss(cell, showGrid, edges)}">${html}</td>`;
            }
            rows += `<tr style="height:${height}px">${tds}</tr>`;
        }

        const note = (ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS)
            ? `<div style="color:#888;margin-top:6px;">僅顯示前 ${MAX_ROWS} 列 / ${MAX_COLS} 欄</div>` : '';
        return `<table class="xl-sheet" style="width:${total}px"><colgroup>${cols}</colgroup><tbody>${rows}</tbody></table>${note}`;
    }

    const STYLE = `<style>
        .xl-block + .xl-block{margin-top:24px}
        .xl-title{color:#0099CC;font:bold 16px sans-serif;margin:0 0 10px}
        .xl-sheet{border-collapse:collapse;table-layout:fixed;font-family:${DEFAULT_FONT};font-size:11pt;color:#000;background:#fff}
        .xl-sheet td{padding:0 3px;overflow:hidden;white-space:nowrap;box-sizing:border-box}
        .xl-sheet td.xl-spill{overflow:visible}
        .xl-sheet td.xl-spill > span{display:inline-block;overflow:hidden;vertical-align:top}
    </style>`;

    // 數字超出欄寬時比照 Excel：通用格式減少小數位數（仍放不下改用科學記號），其他格式與日期顯示整格的 #
    function fitNumbers(root) {
        // 先量完所有格子再一起改寫：邊量邊改的話，每改一格都會讓整張表重新排版
        const jobs = [...root.querySelectorAll('td[data-fit]')].filter(td => td.scrollWidth > td.clientWidth).map(td => {
            const cs = getComputedStyle(td);
            return { td, font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, room: td.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) };
        });
        if (!jobs.length) return;
        const ctx = document.createElement('canvas').getContext('2d');
        let lastFont;
        jobs.forEach(({ td, font, room }) => {
            if (font !== lastFont) ctx.font = lastFont = font;
            const fits = (t) => ctx.measureText(t).width <= room;
            let out = null;
            if (td.dataset.fit === 'g') {
                const n = Number(td.dataset.v), digits = (String(parseFloat(n.toPrecision(12))).split('.')[1] || '').length;
                for (let d = digits - 1; d >= 0 && !out; d--) { const t = String(parseFloat(n.toFixed(d))); if (fits(t)) out = t; }
                for (let d = 5; d >= 0 && !out; d--) {
                    const t = n.toExponential(d).replace(/e([+-])(\d)$/, 'e$10$2').toUpperCase(); // 指數至少兩位，如 1.2E+05
                    if (fits(t)) out = t;
                }
            }
            td.textContent = out || '#'.repeat(Math.max(1, Math.floor(room / ctx.measureText('#').width)));
        });
    }

    async function renderWithExcelJS(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        loadTheme(workbook);
        const sheets = workbook.worksheets.filter(ws => ws.state !== 'hidden' && ws.state !== 'veryHidden');
        // 只有一張工作表時不顯示名稱；多張時才用標題區分
        return STYLE + sheets.map(ws =>
            `<div class="xl-block">${sheets.length > 1 ? `<h3 class="xl-title">${esc(ws.name)}</h3>` : ''}${sheetHtml(ws)}</div>`
        ).join('');
    }

    async function renderWithSheetJS(buffer) {
        if (!window.XLSX) await window.pvLoad(window.PV_LIBS.xlsx); // 用到才載入；來源定義在 viewer.js
        const w = XLSX.read(buffer, { type: 'array' });
        let html = '<style>.xl-plain table{border-collapse:collapse}.xl-plain td,.xl-plain th{border:1px solid #ddd;padding:8px;font-size:13px}</style><div class="xl-plain" style="font-family:sans-serif;">';
        w.SheetNames.forEach(n => {
            const title = w.SheetNames.length > 1 ? `<h3 style="color:#0099CC;font:bold 16px sans-serif;margin:0 0 10px;">${esc(n)}</h3>` : '';
            html += `<div style="margin-bottom:24px;">${title}${XLSX.utils.sheet_to_html(w.Sheets[n])}</div>`;
        });
        return html + '</div>';
    }

    async function parseExcelFile() {
        if (!window.TARGET_URL) return;
        const target = document.getElementById('render-content');
        try {
            const buffer = await (await fetch(window.TARGET_URL)).arrayBuffer();
            let html = null;
            if (window.ExcelJS && window.TARGET_EXT !== 'xls') {
                try { html = await renderWithExcelJS(buffer); }
                catch (e) { console.warn('ExcelJS 解析失敗，改用 SheetJS：', e); }
            }
            target.innerHTML = html || await renderWithSheetJS(buffer);
            if (html) { await document.fonts.ready; fitNumbers(target); } // 字型載入完才量得準
        } catch (e) {
            target.innerHTML = `<div style="color:red;">解析失敗: ${esc(e.message)}</div>`;
        }
    }

    parseExcelFile();
})();
