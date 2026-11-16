// 檢視器頁面（由 content.js 產生的 blob 頁面載入）。依 <body data-pv> 的檔案資訊建立工具列與內容，相依套件用到才載入。
(() => {
    'use strict';
    const { url, category: cat, ext = '', lang } = window.PV = JSON.parse(document.body.dataset.pv);
    const base = document.currentScript.src.split('js/viewer.js')[0];
    const local = (file) => base + 'js/' + file;
    window.TARGET_URL = url; window.TARGET_EXT = ext; // 給 js/*_parser.js 用

    // ---- 第三方套件的來源：extension 分支（本檔）全部用安裝包內的檔案，不從網路載入；main 分支走 CDN。兩個分支只有這一段不同 ----
    const LIBS = window.PV_LIBS = {
        hljs: local('highlight.min.js'),
        hljsCss: base + 'css/github.min.css',
        hljsLang: (name) => local(name + '.min.js'),
        marked: local('marked.min.js'),
        jszip: local('jszip_v3.min.js'),
        pako: local('pako.min.js'),
        exceljs: local('exceljs.min.js'),
        xlsx: local('xlsx.full.min.js')
    };

    // 依序執行、平行下載
    const load = window.pvLoad = (...srcs) => Promise.all(srcs.map(src => new Promise((ok, fail) => {
        document.head.append(Object.assign(document.createElement('script'), { src, async: false, onload: ok, onerror: () => fail(new Error('Failed to load ' + src)) }));
    })));
    const css = (...hrefs) => hrefs.forEach(href => document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href })));
    const hljsDeps = (...langs) => {
        css(LIBS.hljsCss);
        return [LIBS.hljs, ...langs.map(LIBS.hljsLang)];
    };

    const isCode = cat === 'code', isSlides = cat === 'powerpoint';
    const paged = isSlides || ['image', 'video', 'audio'].includes(cat); // 灰底只用於投影片、圖片與影音；文字類內容用滿版白底
    const canRotate = paged && cat !== 'audio';

    // ---- 內容區與相依套件 ----
    const src = `src="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
    const media = 'max-width:100%;display:block;margin:0 auto;';
    const note = (text, style = '') => `<div id="render-content"${style && ` style="${style}"`}>${text}</div>`;
    const [body, deps] = { // deps：回傳要載入的腳本清單（用到才呼叫）
        image: [`<img id="media" ${src} style="${media}height:auto;">`],
        video: [`<video id="media" ${src} controls style="${media}max-height:85vh;outline:none;"></video>`],
        audio: [`<audio ${src} controls style="${media}max-height:85vh;outline:none;"></audio>`],
        code: ['<pre><code></code></pre>'],
        archive: [note(`<div style="padding:15px;color:#666;">${ext === 'zip' ? '讀取 ZIP 結構中...' : '解壓與讀取 TGZ 結構中...'}</div>`),
            () => [ext === 'zip' ? LIBS.jszip : LIBS.pako, ...hljsDeps('verilog', 'matlab'), LIBS.marked, local('ipynb_parser.js'), local('archive_parser.js')]], // ipynb_parser：壓縮檔內的 Notebook 共用同一份渲染
        // ExcelJS 讀得到樣式但只支援 .xlsx；SheetJS 由 excel_parser.js 在 .xls 或失敗時才載入
        excel: [note('繪製表格中...'), () => [...(ext === 'xls' ? [] : [LIBS.exceljs]), local('excel_parser.js')]],
        jupyter: [note('繪製 Notebook 中...', 'max-width:900px;margin:0 auto;font-family:sans-serif;'), () => [...hljsDeps(), LIBS.marked, local('ipynb_parser.js')]],
        powerpoint: ['<div id="container"><div id="pp-loading" class="pp-msg">Loading...</div><div id="warper"><div id="result"></div></div></div>',
            // PPTXjs（含 jQuery、JSZip v2、圖表用的 d3／nvd3）；EMF／TIFF 轉換套件由 ppt.js 用到才載入
            () => (css(base + 'css/pptxjs.css', base + 'css/nv.d3.min.css'),
                ['jquery-1.11.3.min.js', 'jszip.min.js', 'filereader.js', 'd3.min.js', 'nv.d3.min.js', 'pptxjs.min.js', 'ppt.js'].map(local))]
    }[cat];

    // ---- 工具列 ----
    const stroke = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const fill = (d) => `<svg viewBox="0 0 16 16" fill="currentColor">${d}</svg>`; // 與原生檢視器相同的圖示（pdf.js，MPL 2.0）
    const icons = {
        copy: stroke('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
        check: stroke('<polyline points="20 6 9 17 4 12"/>'),
        newTab: `<img src="${base}css/newtab.png" alt="">`, // 原生檢視器的圖示（原生就是 PNG）；放在 css/ 是因為該資料夾已開放給頁面讀取
        download: fill('<path d="M14 3h-2v2h2v8H2V5h7V3h-.849L6.584 1.538A2 2 0 0 0 5.219 1H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM2 3h3.219l1.072 1H2z"/><path d="M8.146 6.146a.5.5 0 0 0 0 .707l2 2a.5.5 0 0 0 .707 0l2-2a.5.5 0 1 0-.707-.707L11 7.293V.5a.5.5 0 0 0-1 0v6.793L8.854 6.146a.5.5 0 0 0-.708 0z"/>'),
        zoomOut: fill('<rect x="2" y="7" width="12" height="2" rx="1"/>'),
        zoomIn: fill('<path d="M14 7H9V2a1 1 0 0 0-2 0v5H2a1 1 0 0 0 0 2h5v5a1 1 0 0 0 2 0V9h5a1 1 0 0 0 0-2z"/>'),
        rotateClockwise: fill('<path d="M15 1a1 1 0 0 0-1 1v2.418A6.995 6.995 0 1 0 8 15a6.954 6.954 0 0 0 4.95-2.05 1 1 0 0 0-1.414-1.414A5.019 5.019 0 1 1 12.549 6H10a1 1 0 0 0 0 2h5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>'),
        more: fill('<path d="M8.707 7.293l-5-5a1 1 0 0 0-1.414 1.414L6.586 8l-4.293 4.293a1 1 0 1 0 1.414 1.414l5-5a1 1 0 0 0 0-1.414zm6 0l-5-5a1 1 0 0 0-1.414 1.414L12.586 8l-4.293 4.293a1 1 0 1 0 1.414 1.414l5-5a1 1 0 0 0 0-1.414z"/>')
    };
    // [id, 標題, 主工具列的顯示規則, 選單內的顯示規則]；主工具列與「»」選單各有一顆同功能的按鈕
    const actions = [
        ['download', 'Download', 'visibleMediumView', 'hiddenMediumView'],
        ['zoomOut', 'Zoom Out', 'visibleLargeView', ''],
        ['zoomIn', 'Zoom In', 'visibleLargeView', ''],
        ...(canRotate ? [['rotateClockwise', 'Rotate Clockwise', 'visibleLargeView', '']] : [])
    ];
    const secondaryId = (id) => 'secondary' + id[0].toUpperCase() + id.slice(1);

    document.body.className = paged ? 'paged' : '';
    document.body.innerHTML = `
        <div id="toolbar" class="toolbar">
            ${isSlides ? '<div class="toolbar-center"><input type="number" id="pageNumber" class="toolbarField" title="Page" value="1" min="1"><span id="numPages" class="toolbarLabel">/ 1</span></div>' : ''}
            <div class="toolbar-right">
                <div class="splitToolbarButton">
                    ${isCode ? `<button id="pv-copy" class="toolbarButton" title="Copy">${icons.copy}</button>` : ''}
                    <a id="newTab" class="toolbarButton" title="New Tab" target="_blank">${icons.newTab}</a>
                    ${actions.map(([id, title, cls]) => `<button id="${id}" class="toolbarButton ${cls}" title="${title}">${icons[id]}</button>`).join('\n')}
                    <button id="secondaryToolbarToggle" class="toolbarButton hiddenLargeView" title="Secondary Toolbar">${icons.more}</button>
                </div>
                <div id="secondaryToolbar" class="secondaryToolbar hidden">
                    ${actions.map(([id, title, , cls]) => `<button id="${secondaryId(id)}" class="secondaryToolbarButton ${cls}">${icons[id]} ${title}</button>`).join('')}
                </div>
            </div>
        </div>
        <div id="viewerContainer"><div id="zoom-content">${body}</div></div>`;

    const $ = (id) => document.getElementById(id);
    const menu = $('secondaryToolbar'), zc = $('zoom-content'), vc = $('viewerContainer');
    const bind = (id, fn) => { $(id).onclick = $(secondaryId(id)).onclick = fn; };

    $('newTab').href = location.href; // 檢視器本身就是一個 blob 頁面，新分頁直接開同一個網址，兩邊外觀必然一致
    bind('download', () => Object.assign(document.createElement('a'), { href: url + (url.includes('?') ? '&' : '?') + 'download_frd=1', target: '_blank' }).click());
    $('secondaryToolbarToggle').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); };
    menu.onclick = (e) => e.stopPropagation();
    document.addEventListener('click', () => menu.classList.add('hidden'));

    // ---- 縮放與旋轉 ----
    // 文字類內容直接用 CSS zoom；頁面類內容（投影片／圖片／影片）改為調整寬度，讓外框跟著變寬、超出時可水平捲動而不被截斷。
    // 旋轉時每個目標包一層 .rot-wrap：轉 90°/270° 由外層佔住旋轉後的版面，目標本身改為絕對定位再旋轉並縮放。
    let scale = 1, rot = 0, busy = false;
    const targets = () => document.querySelectorAll('#media, #result .slide');
    const refit = () => { busy = true; window.dispatchEvent(new Event('resize')); busy = false; }; // 讓簡報依新寬度重排
    const layout = () => {
        if (!paged) { zc.style.zoom = scale; return; }
        // 1) 還原成未旋轉、未縮放的狀態，再套用縮放：投影片跟著 #zoom-content 的寬度重排；圖片與影片直接設定寬度
        zc.style.width = '';
        targets().forEach(el => {
            let wrap = el.parentNode;
            if (!wrap.classList.contains('rot-wrap')) {
                wrap = Object.assign(document.createElement('div'), { className: 'rot-wrap' });
                el.replaceWith(wrap); wrap.append(el);
                el.dataset.css = el.style.cssText;
            }
            wrap.style.cssText = '';
            el.style.cssText = el.dataset.css;
            if (el.id !== 'media') return;
            el.dataset.bw ||= el.offsetWidth || '';
            if (scale !== 1 && el.dataset.bw) el.style.cssText += `;max-width:none;max-height:none;height:auto;width:${el.dataset.bw * scale}px`;
        });
        if (scale !== 1) zc.style.width = `calc((100% - 40px) * ${scale})`;
        refit();
        if (!rot) return;
        // 2) 旋轉：投影片填滿寬度（同原生的頁寬縮放），圖片與影片不放大
        targets().forEach(el => {
            if (rot === 180) { el.style.transform = 'rotate(180deg)'; return; }
            const wrap = el.parentNode, W = wrap.offsetWidth, w = el.offsetWidth, h = el.offsetHeight;
            if (!w || !h) return;
            const k = el.id !== 'media' ? W / h : scale > 1 ? 1 : Math.min(1, W / h);
            wrap.style.cssText = `width:${h * k}px;height:${w * k}px;margin-bottom:${getComputedStyle(el).marginBottom}`;
            Object.entries({
                position: 'absolute', top: 0, left: 0, width: w + 'px', height: h + 'px', 'max-width': 'none', 'max-height': 'none', 'transform-origin': '0 0',
                transform: `${rot === 90 ? `translate(${h * k}px,0)` : `translate(0,${w * k}px)`} rotate(${rot}deg) scale(${k})`
            }).forEach(([prop, value]) => el.style.setProperty(prop, value, 'important'));
        });
        refit();
    };
    const zoom = (delta) => { scale = Math.min(4, Math.max(0.25, scale + delta)); layout(); };
    bind('zoomOut', () => zoom(-0.15));
    bind('zoomIn', () => zoom(0.15));
    if (canRotate) bind('rotateClockwise', () => { rot = (rot + 90) % 360; layout(); });
    window.addEventListener('resize', () => { if (rot && !busy) layout(); });

    // ---- 頁碼（僅簡報）：捲動時顯示目前投影片，輸入數字後跳到該張 ----
    if (isSlides) {
        const pn = $('pageNumber'), slides = () => document.querySelectorAll('#result .slide');
        const top = (el) => el.getBoundingClientRect().top;
        const update = () => {
            const ps = slides(), mid = top(vc) + vc.clientHeight / 2;
            if (!ps.length) return;
            let cur = 1;
            while (cur < ps.length && top(ps[cur]) <= mid) cur++;
            $('numPages').textContent = '/ ' + ps.length; pn.max = ps.length;
            if (document.activeElement !== pn) pn.value = cur;
        };
        pn.onchange = () => {
            const ps = slides(), n = Math.min(ps.length, Math.max(1, parseInt(pn.value, 10) || 1));
            if (!ps.length) return;
            pn.value = n; pn.blur();
            vc.scrollTop += top(ps[n - 1]) - top(vc);
        };
        vc.addEventListener('scroll', update);
        window.addEventListener('resize', update);
    }

    // ---- 載入內容 ----
    if (isCode) {
        const code = zc.querySelector('code'), copyBtn = $('pv-copy');
        const text = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
        text.then(t => { code.textContent = t; }, e => { zc.innerHTML = `<div class="pv-error">讀取失敗: ${e.message}</div>`; });
        // 先顯示純文字，語法上色的套件載入後再套用
        Promise.all([text, load(...hljsDeps(...['verilog', 'matlab'].filter(l => l === lang)))])
            .then(() => { code.className = 'language-' + lang; hljs.highlightElement(code); }, () => {});
        copyBtn.onclick = () => navigator.clipboard.writeText(code.textContent).then(() => {
            const { innerHTML, title } = copyBtn;
            Object.assign(copyBtn, { innerHTML: icons.check, title: 'Copied' });
            setTimeout(() => Object.assign(copyBtn, { innerHTML, title }), 2000);
        });
    } else if (deps) {
        load(...deps()).catch(e => { ($('render-content') || $('container')).innerHTML = `<div class="pv-error">${e.message}</div>`; });
    }
})();
