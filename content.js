// 在 NTU COOL 頁面上接管檔案預覽：決定「哪裡」放檢視器。檢視器本身的畫面與邏輯在 js/viewer.js、css/viewer.css。
(() => {
    'use strict';

    // 預設副檔名（DEFAULT_SETTINGS）定義在 defaults.js，manifest 會先載入它
    const langMap = { py: 'python', v: 'verilog', sv: 'verilog', c: 'c', cpp: 'cpp', js: 'javascript', html: 'xml', css: 'css', json: 'json', md: 'markdown', sh: 'bash', java: 'java', m: 'matlab' };
    const extMap = {}; // 副檔名 → { category, ext, lang }
    const isZh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    const extUrl = chrome.runtime.getURL('');

    const fileInfoOf = (filename) => extMap[filename.split('.').pop().toLowerCase()];
    const el = (tag, props, css) => {
        const node = Object.assign(document.createElement(tag), props);
        if (css) node.style.cssText = css;
        return node;
    };

    // ---- 檢視器 ----
    // 檢視器是一個 blob 頁面（與 COOL 同源，才能帶著登入狀態抓檔案），內容只有檔案資訊與 viewer.js。
    // 每個放置區只產生一次並重複使用；不釋放，因為使用者可能已在新分頁開啟同一個網址。
    function viewerUrl(filename, url, info) {
        // 壓縮檔另外帶上使用者設定的類型表，讓壓縮檔內可預覽的檔案類型與設定一致
        // 檔案資訊放在 data 屬性而不是行內 <script>，頁面裡就完全沒有行內腳本
        const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const config = JSON.stringify({ url: new URL(url, location.href).href, ...info, ...(info.category === 'archive' && { types: extMap }) });
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escape(filename)}</title><link rel="stylesheet" href="${extUrl}css/viewer.css"></head>`
            + `<body data-pv="${escape(config)}"><script src="${extUrl}js/viewer.js"></script></body></html>`;
        return URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    }
    function showViewer(area, filename, url, info) {
        area._viewerUrl ||= viewerUrl(filename, url, info);
        // 與原生相同：<iframe width="100%" height="100%">，不另外覆寫樣式
        area.innerHTML = `<iframe class="pv-frame" src="${area._viewerUrl}" width="100%" height="100%"></iframe>`;
    }

    // ---- 1. 作業繳交頁：在檔案旁加「預覽」連結，點擊後開啟與原生相同的對話框 ----
    function createDialog(filename) {
        const titleId = 'ui-id-custom-' + Math.floor(Math.random() * 1e9);
        const overlay = el('div', { className: 'ui-widget-overlay' }, 'display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1001;');
        const dialog = el('div', { className: 'ui-dialog ui-widget ui-widget-content ui-corner-all ui-draggable ui-resizable', tabIndex: -1 }, 'display:none;outline:0;z-index:1002;position:absolute;');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-labelledby', titleId);

        const header = el('div', { className: 'ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix ui-draggable-handle' });
        const closeBtn = el('a', { href: '#', className: 'ui-dialog-titlebar-close ui-corner-all', role: 'button', innerHTML: `<span class="ui-icon ui-icon-closethick">${isZh ? '關閉' : 'Close'}</span>` });
        header.append(el('span', { id: titleId, className: 'ui-dialog-title', innerText: isZh ? `${filename} 的預覽` : `Preview of ${filename}` }), closeBtn);
        const content = el('div', { className: 'ui-dialog-content ui-widget-content' }, 'padding:0;overflow:hidden;width:auto;min-height:0;');
        const shield = el('div', {}, 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1004;display:none;'); // 拖曳期間蓋住 iframe，避免滑鼠事件被吃掉
        dialog.append(header, content, shield);
        document.body.append(dialog, overlay);

        const close = () => { dialog.style.display = overlay.style.display = 'none'; content.innerHTML = ''; };
        closeBtn.onmouseenter = closeBtn.onmouseleave = (e) => closeBtn.classList.toggle('ui-state-hover', e.type === 'mouseenter');
        closeBtn.onclick = (e) => { e.preventDefault(); close(); };
        dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

        // 拖曳與縮放。dialog 為 position:absolute，座標需加上捲動量
        const root = document.documentElement, MIN = 150;
        let dir, startX, startY, box;
        const place = (left, top) => { dialog.style.left = left + scrollX + 'px'; dialog.style.top = top + scrollY + 'px'; };
        const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
        const onMove = (e) => {
            const dx = e.clientX - startX, dy = e.clientY - startY;
            let { left, top, width, height } = box;
            if (!dir) return place(clamp(left + dx, 0, root.clientWidth - dialog.offsetWidth), clamp(top + dy, 0, root.clientHeight - dialog.offsetHeight));
            if (dir.includes('e')) width = clamp(width + dx, MIN, root.clientWidth - left);
            if (dir.includes('s')) height = clamp(height + dy, MIN, root.clientHeight - top);
            if (dir.includes('w')) { left = clamp(left + dx, 0, box.right - MIN); width = box.right - left; }
            if (dir.includes('n')) { top = clamp(top + dy, 0, box.bottom - MIN); height = box.bottom - top; }
            dialog.style.width = width + 'px';
            content.style.height = height - header.offsetHeight + 'px';
            place(left, top);
        };
        const onUp = () => {
            shield.style.display = 'none';
            removeEventListener('mousemove', onMove, true);
            removeEventListener('mouseup', onUp, true);
        };
        const startDrag = (e, direction, cursor) => {
            e.preventDefault();
            dir = direction; startX = e.clientX; startY = e.clientY; box = dialog.getBoundingClientRect();
            Object.assign(shield.style, { cursor, display: 'block' });
            addEventListener('mousemove', onMove, true);
            addEventListener('mouseup', onUp, true);
        };
        header.addEventListener('mousedown', (e) => { if (!e.target.closest('a, button')) startDrag(e, '', 'move'); });
        // 把手的位置、大小與游標皆由 COOL 內建的 jQuery UI 樣式（.ui-resizable-*）提供，與原生一致
        ['n', 'e', 's', 'w', 'se', 'sw', 'ne', 'nw'].forEach(d => {
            const handle = el('div', { className: `ui-resizable-handle ui-resizable-${d}${d === 'se' ? ' ui-icon ui-icon-gripsmall-diagonal-se ui-icon-grip-diagonal-se' : ''}` }, 'z-index:1000;');
            handle.addEventListener('mousedown', (e) => { e.stopPropagation(); startDrag(e, d, getComputedStyle(handle).cursor); });
            dialog.append(handle);
        });

        // 與原生相同的公式（Canvas: .dialog({ width: $(document).width()*0.95, height: $(document).height()*0.75 })，再由 jQuery UI 置中）。
        // 桌機與手機的差異來自捲軸寬度：對話框顯示後、定位前會把文件撐高而出現捲軸，
        // 所以必須在「已顯示、尚未定位」時量 clientWidth，才會和原生得到相同的 left。
        const open = () => {
            const body = document.body;
            const docW = Math.max(root.scrollWidth, root.offsetWidth, root.clientWidth, body.scrollWidth, body.offsetWidth);
            const docH = Math.max(root.scrollHeight, root.offsetHeight, root.clientHeight, body.scrollHeight, body.offsetHeight);
            Object.assign(dialog.style, { width: docW * 0.95 + 'px', height: 'auto', left: '', top: '', display: 'block' });
            overlay.style.display = 'block';
            content.style.height = Math.max(0, docH * 0.75 - header.getBoundingClientRect().height) + 'px';
            dialog.style.left = Math.round(scrollX + Math.max(0, (root.clientWidth - dialog.offsetWidth) / 2)) + 'px';
            dialog.style.top = Math.round(scrollY + Math.max(0, (root.clientHeight - dialog.offsetHeight) / 2)) + 'px';
            dialog.focus();
        };
        return { open, content };
    }

    function injectSubmissionButtons() {
        document.querySelectorAll('.file-upload-submission').forEach(sub => {
            const slot = sub.querySelector('.file-upload-submission-attachment'), link = sub.querySelector('.file-upload-submission-info__link');
            if (!slot || !link || slot.querySelector('.custom-preview-btn')) return;
            const filename = link.innerText.trim(), info = fileInfoOf(filename);
            if (!info) return;

            let dialog; // 第一次點擊時才建立對話框
            const btn = el('a', { innerText: isZh ? '預覽' : 'Preview', href: link.href, className: 'Button--link custom-preview-btn', role: 'button' });
            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                dialog ||= createDialog(filename);
                showViewer(dialog.content, filename, link.href, info);
                dialog.open();
            };
            slot.append(btn);
        });
    }

    // ---- 2. 檔案頁：與原生相同，檢視器放在頁面上的 #doc_preview 內 ----
    function injectFilePage() {
        const main = document.querySelector('#content.ic-Layout-contentMain');
        if (!main) return;
        const existing = main.querySelector('.custom-auto-preview');
        // COOL 自己的預覽若晚一步載入並蓋掉我們的檢視器，就再放回去
        if (existing) { if (!existing.querySelector('iframe.pv-frame')) existing._show(); return; }

        const heading = main.querySelector('h2'), download = main.querySelector('a[download]');
        const filename = heading && download && heading.innerText.trim(), info = filename && fileInfoOf(filename);
        if (!info) return;

        // COOL 不認得的檔案類型沒有 #doc_preview，就在同樣的位置自己建一個
        const footer = main.querySelector('#sequence_footer');
        let area = main.querySelector('#doc_preview');
        if (!area) main.insertBefore(area = el('div', { id: 'doc_preview' }), footer);
        area.classList.add('custom-auto-preview');
        main.classList.add('hide-native-preview');

        // 高度與原生相同：填滿視窗剩餘空間（扣掉下方的上一步／下一步列與內容區留白），最少 400px
        const fitHeight = () => {
            const reserved = (footer ? footer.offsetHeight : 0) + parseFloat(getComputedStyle(main).paddingBottom);
            area.style.height = Math.max(400, innerHeight - area.getBoundingClientRect().top - scrollY - reserved) + 'px';
        };
        fitHeight();
        addEventListener('resize', fitHeight);
        (area._show = () => showViewer(area, filename, download.href, info))();
    }

    // ---- 3. 公告、討論、頁面內文中的檔案連結：點擊後 COOL 會開啟全螢幕預覽層 ----
    // 外框（檔名、下載、關閉）維持原生，只把裡面的檢視器換成我們的。原生 iframe 交給 React 管理，不移除只隱藏。
    function injectOverlay() {
        const overlay = document.querySelector('.ef-file-preview-overlay');
        const stretch = overlay && overlay.querySelector('.ef-file-preview-stretch');
        const name = overlay && overlay.querySelector('.ef-file-preview-header-filename');
        const download = overlay && overlay.querySelector('.ef-file-preview-header-download');
        if (!stretch || !name || !download || stretch._pvKey === download.href) return;

        stretch._pvKey = download.href; // 在預覽層內切換到上一個／下一個檔案時會改變
        stretch.querySelectorAll(':scope > .pv-frame').forEach(node => node.remove());
        const filename = name.innerText.trim(), info = fileInfoOf(filename);
        stretch.classList.toggle('pv-active', !!info);
        stretch.classList.add('pv-checked');
        // 沿用原生 iframe 的 class，尺寸規則（height:91vh、與「資訊」面板的寬度分配）就和原生完全相同
        if (info) stretch.prepend(el('iframe', { className: 'ef-file-preview-frame pv-frame', src: viewerUrl(filename, download.href, info) }));
    }

    // ---- 啟動 ----
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        Object.entries(settings).forEach(([group, list]) => (list || '').split(',').forEach(raw => {
            const ext = raw.trim().toLowerCase();
            if (!ext) return;
            extMap[ext] = group === 'plaintext' ? { category: 'code', lang: 'plaintext' }
                : group === 'codes' ? { category: 'code', lang: langMap[ext] || ext }
                : { category: group.replace(/s$/, ''), ext };
        }));
        const classes = Object.keys(extMap).map(ext => '.' + ext).join(', ');
        if (!classes) return;

        document.head.append(el('style', { textContent: `
            .file-upload-submission:has(${classes}) .modal_preview_link { display: none !important; }
            #content.hide-native-preview .viewerContainer { display: none !important; }
            /* COOL 自己的預覽 iframe（例如「No preview is available」）可能在我們之後才被加進 #doc_preview，一律隱藏 */
            .custom-auto-preview > :not(.pv-frame) { display: none !important; }
            /* 全螢幕預覽層：隱藏原生檢視器（「資訊」面板保留），改顯示我們的；還沒判斷完檔案類型前先不顯示，避免閃一下 */
            .ef-file-preview-stretch.pv-active > :not(.pv-frame):not(.ef-file-preview-information-container) { display: none !important; }
            .ef-file-preview-stretch:not(.pv-checked) > :not(.pv-frame):not(.ef-file-preview-information-container) { visibility: hidden !important; }
        ` }));

        const scan = () => { injectSubmissionButtons(); injectFilePage(); };
        let timer;
        scan(); injectOverlay();
        new MutationObserver((mutations) => {
            if (!mutations.some(m => m.addedNodes.length || m.type !== 'childList')) return;
            injectOverlay(); // 很輕量，立即執行，讓預覽層一出現就換成我們的檢視器
            clearTimeout(timer);
            timer = setTimeout(scan, 300);
        }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
    });
})();
