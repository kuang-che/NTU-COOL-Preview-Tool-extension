(function () {
    'use strict';

    const defaultSettings = {
        images: 'png, jpg, jpeg, gif, svg, webp',
        videos: 'mp4, webm, ogg, mov',
        audios: 'mp3, wav, ogg, m4a',
        codes: 'py, v, sv, c, cpp, js, html, css, json, md, sh, java, m',
        plaintext: 'txt, log, csv',
        archives: 'zip, tgz, gz',
        excels: 'xls, xlsx',
        powerpoints: 'ppt, pptx',
        jupyter: 'ipynb'
    };

    const langMap = { py: 'python', v: 'verilog', sv: 'verilog', c: 'c', cpp: 'cpp', js: 'javascript', html: 'xml', css: 'css', json: 'json', md: 'markdown', sh: 'bash', java: 'java', m: 'matlab' };
    const extMap = {};
    const isZh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    const i18n = {
        btnText: isZh ? '預覽' : 'Preview',
        titlePrefix: isZh ? ' 的預覽' : 'Preview of ',
        loading: isZh ? '正在讀取...' : 'Loading...',
        errorPrefix: isZh ? '讀取失敗: ' : 'Failed to load: ',
        copy: isZh ? '複製內容' : 'Copy',
        copied: isZh ? '已複製' : 'Copied',
        newTab: isZh ? '在新分頁中開啟' : 'New Tab',
        download: isZh ? '下載' : 'Download'
    };

    function parseSettings(settings) {
        Object.entries(settings).forEach(([cat, exts]) => {
            if (!exts) return;
            exts.split(',').forEach(ext => {
                const e = ext.trim().toLowerCase();
                if (!e) return;
                const baseCat = cat.replace(/s$/, '');
                if (cat === 'plaintext') extMap[e] = { category: 'code', lang: 'plaintext' };
                else if (cat === 'codes') extMap[e] = { category: 'code', lang: langMap[e] || e };
                else extMap[e] = { category: baseCat, ...(baseCat === 'archive' && { ext: e }) };
            });
        });
    }

    const getFileTypeInfo = (filename) => extMap[filename.split('.').pop().toLowerCase()] || null;
    const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function createEl(tag, props = {}, cssText = '') {
        const el = Object.assign(document.createElement(tag), props);
        if (cssText) el.style.cssText = cssText;
        return el;
    }

    const getToolbarHtml = (idPrefix) => `
        <button id="${idPrefix}-copyBtn" title="${i18n.copy}" style="display:none; align-items:center; justify-content:center; color:#000; background:transparent; border:none; cursor:pointer; padding:0; outline:none; transition:color 0.2s; font-family:inherit; font-size:13px; min-width:28px; height:22px; border-radius:2px;">
            <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span class="copy-text" style="display:none; font-weight:normal; white-space:nowrap; padding:0 4px;">${i18n.copied}</span>
        </button>
        <a id="${idPrefix}-newTabBtn" title="${i18n.newTab}" style="display:flex; align-items:center; justify-content:center; color:#000; text-decoration:none; cursor:pointer; padding:0; transition:color 0.2s; width:28px; height:22px; border-radius:2px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
        <button id="${idPrefix}-downloadBtn" title="${i18n.download}" style="display:flex; align-items:center; justify-content:center; color:#000; background:transparent; border:none; cursor:pointer; padding:0; outline:none; transition:color 0.2s; width:28px; height:22px; border-radius:2px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
    `;

    function setupToolbarEvents(container, idPrefix, url) {
        const copyBtn = container.querySelector(`#${idPrefix}-copyBtn`);
        const newTabBtn = container.querySelector(`#${idPrefix}-newTabBtn`);
        const downloadBtn = container.querySelector(`#${idPrefix}-downloadBtn`);

        [copyBtn, newTabBtn, downloadBtn].forEach(b => {
            if (!b) return;
            b.onmouseenter = () => b.style.color = '#0099CC';
            b.onmouseleave = () => b.style.color = '#000';
        });

        downloadBtn.onclick = (e) => {
            e.preventDefault();
            const absoluteUrl = new URL(url, window.location.href).href;
            let dlUrl = absoluteUrl + (absoluteUrl.includes('?') ? '&' : '?') + 'download_frd=1';
            const a = document.createElement('a');
            a.href = dlUrl;
            a.target = '_blank';
            a.click();
        };

        return { copyBtn, newTabBtn };
    }

    function generateViewerHTML(filename, fileInfo, absoluteUrl, textContent, isFullScreen) {
        let bodyHtml = '', extraDependencies = '', parserScript = '';
        const { category, ext, lang } = fileInfo;

        if (category === 'image') {
            bodyHtml = `<img src="${absoluteUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`;
        } else if (category === 'video' || category === 'audio') {
            bodyHtml = `<${category} src="${absoluteUrl}" controls style="max-width:100%;max-height:85vh;display:block;margin:0 auto;outline:none;"></${category}>`;
        } else if (category === 'archive') {
            const extUrl = chrome.runtime.getURL('js/archive_parser.js');
            const targetParams = `<script>window.TARGET_URL="${absoluteUrl}"; window.TARGET_EXT="${ext}";</script>`;
            if (ext === 'zip') {
                extraDependencies = `<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>`;
                bodyHtml = `<div id="render-content"><div style="padding:15px;color:#666;">讀取 ZIP 結構中...</div></div>`;
                parserScript = `${targetParams}<script src="${extUrl}"></script>`;
            } else if (['tgz', 'gz'].includes(ext)) {
                extraDependencies = `<script src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"></script>`;
                bodyHtml = `<div id="render-content"><div style="padding:15px;color:#666;">解壓與讀取 TGZ 結構中...</div></div>`;
                parserScript = `${targetParams}<script src="${extUrl}"></script>`;
            }
        } else if (category === 'excel') {
            const extUrl = chrome.runtime.getURL('js/excel_parser.js');
            const targetParams = `<script>window.TARGET_URL="${absoluteUrl}"; window.TARGET_EXT="${ext}";</script>`;
            extraDependencies = `<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>`;
            bodyHtml = `<div id="render-content" style="overflow-x:auto;padding:15px;">繪製表格中...</div>`;
            parserScript = `${targetParams}<script src="${extUrl}"></script>`;
        } else if (category === 'jupyter') {
            const extUrl = chrome.runtime.getURL('js/ipynb_parser.js');
            const targetParams = `<script>window.TARGET_URL="${absoluteUrl}";</script>`;
            extraDependencies = `<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.2/marked.min.js"></script>`;
            bodyHtml = `<div id="render-content" style="padding:20px;max-width:900px;margin:0 auto;font-family:sans-serif;">繪製 Notebook 中...</div>`;
            parserScript = `${targetParams}<script src="${extUrl}"></script>`;
        } else if (category === 'powerpoint') {
            const eu = chrome.runtime.getURL('');
            extraDependencies = `
                <link rel="stylesheet" href="${eu}css/pptxjs.css">
                <link rel="stylesheet" href="${eu}css/nv.d3.min.css">
                <script src="${eu}js/jquery-1.11.3.min.js"></script>
                <script src="${eu}js/jszip.min.js"></script>
                <script src="${eu}js/filereader.js"></script>
                <script src="${eu}js/d3.min.js"></script>
                <script src="${eu}js/nv.d3.min.js"></script>
                <script src="${eu}js/pptxjs.min.js"></script>
                <script src="${eu}js/divs2slides.min.js"></script>
                <style>
                    html,body{margin:0;padding:0;overflow-x:hidden;background-color:transparent}
                    #container{width:100%;overflow:hidden;padding-top:10px}
                    #warper{margin:0;width:1280px}
                    .slide{width:100%!important;margin:0!important;border:1px solid #ddd;box-shadow:0 4px 8px rgba(0,0,0,0.1);border-radius:4px;background:white}
                    .error-msg{text-align:center;padding:30px;color:#d9534f;font-size:18px;font-family:sans-serif;}
                </style>
            `;
            bodyHtml = `<div id="container"><div id="warper"><div id="result"></div></div></div>`;
            parserScript = `
                <script>
                $(function(){
                    var $container = $('#container');
                    var $result = $('#result');
                    function showError(msg) {
                        $container.html('<div class="error-msg">簡報載入失敗：' + (msg || '發生未知錯誤，請檢查檔案格式') + '</div>');
                    }
                    try {
                        if (typeof $result.pptxToHtml !== 'function') throw new Error('核心套件無法載入');
                        $result.pptxToHtml({
                            pptxFileUrl: "${absoluteUrl}",
                            slideMode: !1,
                            keyBoardShortCut: !1,
                            slideModeConfig: {first:1, nav:!1, showPlayPauseBtn:!1, keyBoardShortCut:!1, showSlideNum:!1, showTotalSlideNum:!1, autoSlide:!1, randomAutoSlide:!1, loop:!1, background:"black", transition:"default", transitionTime:1}
                        });
                        function fitSlides(){
                            var slideDom = $('.slide').first()[0];
                            var realW = (slideDom && parseInt(slideDom.style.width,10)) || 1280;
                            $('#warper').css('width', realW + 'px');
                            var c = $container.width(), s = Math.min(1, c/(realW+2));
                            $('#warper').css({'transform': 'scale('+s+')', 'transform-origin': 'top left'});
                            var h = $('#warper')[0].getBoundingClientRect().height;
                            if (h > 0) $container.css('height', (h+15) + 'px');
                        }
                        $(window).on('resize', fitSlides);
                        var attempts = 0, maxAttempts = 40; 
                        var l = setInterval(function(){
                            if($('.slide').length > 0){
                                fitSlides();
                                clearInterval(l);
                            } else {
                                attempts++;
                                if(attempts >= maxAttempts){
                                    clearInterval(l);
                                    showError('處理時間逾時');
                                }
                            }
                        }, 250);
                    } catch(e) {
                        console.error('PPTX Parse Error:', e);
                        showError(e.message);
                    }
                });
                </script>
            `;
        } else {
            bodyHtml = `<pre><code class="language-${lang}">${escapeHTML(textContent)}</code></pre>`;
        }

        const isCode = category === 'code';
        const codeDeps = (isCode || category === 'archive' || category === 'jupyter') ? `
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/verilog.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/matlab.min.js"></script>
            <style>pre{margin:0;font-size:14px;white-space:pre-wrap;word-wrap:break-word}</style>
        ` : '';
        const markedDeps = (category === 'archive' || category === 'jupyter') ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.2/marked.min.js"></script>` : '';
        const initScript = isCode ? `<script>hljs.highlightAll();</script>` : '';

        if (!isFullScreen) {
            return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><style>body{margin:0;padding:15px;height:100%;overflow:auto;box-sizing:border-box;font-family:sans-serif;}</style>${codeDeps}${markedDeps}${extraDependencies}</head><body>${bodyHtml}${initScript}${parserScript}</body></html>`;
        }

        return `
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <title>${filename}</title>
                ${codeDeps}${markedDeps}${extraDependencies}
                <style>
                    body{margin:0;background:#525659;font-family:sans-serif;display:flex;flex-direction:column;height:100vh;overflow:hidden}
                    .toolbar{background:#474747;height:32px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;z-index:100;flex-shrink:0}
                    .toolbar-center{position:absolute;left:50%;transform:translateX(-50%);color:#f9f9fa;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40%}
                    .toolbar-right{display:flex;align-items:center;gap:4px}
                    .toolbarButton{background:none;border:none;color:#f9f9fa;height:26px;min-width:26px;padding:2px 6px;border-radius:2px;cursor:pointer;display:inline-flex;align-items:center;transition:background 0.2s}
                    .toolbarButton:hover{background:hsla(0,0%,100%,.12)}
                    .toolbarButton svg{width:14px;height:14px}
                    .divider{width:1px;height:16px;background:rgba(255,255,255,0.2);margin:0 4px}
                    .viewerContainer{flex-grow:1;overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start}
                    .page{background:#fff;box-shadow:0 2px 5px rgba(0,0,0,0.2);padding:30px;transition:transform 0.15s;transform-origin:top center;min-width:60%;max-width:1200px;min-height:80vh;}
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div></div>
                    <div class="toolbar-center">${filename}</div>
                    <div class="toolbar-right">
                        ${isCode ? `<button id="fs-copy-btn" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/></svg><span style="font-size:12px;margin-left:6px">${i18n.copy}</span></button><div class="divider"></div>` : ''}
                        <button id="zoomOut" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path d="M3.5 6.5A.5.5 0 0 1 4 6h5a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5z"/><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg></button>
                        <button id="zoomIn" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path d="M6.5 10a.5.5 0 0 1-.5-.5V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 1 0V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-.5.5z"/><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg></button>
                        <div class="divider"></div>
                        <button id="download" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg></button>
                    </div>
                </div>
                <div class="viewerContainer">
                    <div id="zoom-content" class="${['video', 'audio'].includes(category) ? '' : 'page'}">${bodyHtml}</div>
                </div>
                ${initScript}${parserScript}
                <script>
                    const cb = document.getElementById('fs-copy-btn');
                    if (cb) {
                        const ot = cb.querySelector('span').innerText;
                        cb.onclick = async () => {
                            try {
                                cb.querySelector('span').innerText = '...';
                                await navigator.clipboard.writeText(await (await fetch("${absoluteUrl}")).text());
                                cb.querySelector('span').innerText = '${i18n.copied}';
                                setTimeout(() => cb.querySelector('span').innerText = ot, 2000);
                            } catch (e) {}
                        };
                    }
                    const db = document.getElementById('download');
                    if (db) {
                        db.onclick = () => {
                            let u = "${absoluteUrl}";
                            u += u.includes('?') ? '&download_frd=1' : '?download_frd=1';
                            const a = document.createElement('a');
                            a.href = u;
                            a.target = '_blank';
                            a.click();
                        };
                    }
                    let sc = 1;
                    const zc = document.getElementById('zoom-content');
                    document.getElementById('zoomIn').onclick = () => { sc += 0.15; zc.style.transform = \`scale(\${sc})\`; };
                    document.getElementById('zoomOut').onclick = () => { sc = Math.max(0.2, sc - 0.15); zc.style.transform = \`scale(\${sc})\`; };
                </script>
            </body>
            </html>
        `;
    }

    async function generateAndInjectIframes(url, filename, fileInfo, contentArea, copyBtn, newTabBtn) {
        const absoluteUrl = new URL(url, window.location.href).href;
        let textContent = '';

        if (fileInfo.category === 'code') {
            try {
                textContent = await (await fetch(absoluteUrl)).text();
                if (copyBtn) {
                    copyBtn.style.display = 'flex';
                    copyBtn.onclick = () => {
                        if (copyBtn.style.pointerEvents === 'none') return;
                        navigator.clipboard.writeText(textContent).then(() => {
                            const icon = copyBtn.querySelector('.copy-icon');
                            const text = copyBtn.querySelector('.copy-text');
                            if (icon && text) {
                                icon.style.display = 'none';
                                text.style.display = 'inline';
                                copyBtn.style.color = '#0099CC';
                                copyBtn.style.pointerEvents = 'none';
                                setTimeout(() => {
                                    icon.style.display = 'inline-block';
                                    text.style.display = 'none';
                                    copyBtn.style.color = '#555';
                                    copyBtn.style.pointerEvents = 'auto';
                                }, 2000);
                            }
                        });
                    };
                }
            } catch (e) {
                contentArea.innerHTML = `<div style="color:#d9534f;padding:15px;">${i18n.errorPrefix}${e.message}</div>`;
                if (copyBtn) copyBtn.style.display = 'none';
                return;
            }
        } else if (copyBtn) {
            copyBtn.style.display = 'none';
        }

        const makeBlobUrl = (html) => URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
        contentArea.innerHTML = `<iframe src="${makeBlobUrl(generateViewerHTML(filename, fileInfo, absoluteUrl, textContent, false))}" style="width:100%;height:100%;border:none;display:block;margin:0;flex-grow:1;"></iframe>`;

        if (newTabBtn) {
            newTabBtn.href = makeBlobUrl(generateViewerHTML(filename, fileInfo, absoluteUrl, textContent, true));
            newTabBtn.target = '_blank';
        }
    }

    function enableDragAndResize(previewContainer, header, dragOverlay, contentArea) {
        let isDragging = false, isResizing = false, sX, sY, iL, iT, iW, iH, currentDir = '';

        const handleMove = (e) => {
            if (isDragging) {
                const nL = Math.max(0, Math.min(iL + (e.clientX - sX), window.innerWidth - previewContainer.offsetWidth));
                const nT = Math.max(0, Math.min(iT + (e.clientY - sY), window.innerHeight - previewContainer.offsetHeight));
                previewContainer.style.left = nL + 'px';
                previewContainer.style.top = nT + 'px';
            } else if (isResizing) {
                let dx = e.clientX - sX, dy = e.clientY - sY, nW = iW, nH = iH, nL = iL, nT = iT;

                if (currentDir.includes('e')) nW = Math.max(150, Math.min(iW + dx, window.innerWidth - iL - 2));
                if (currentDir.includes('s')) nH = Math.max(150, Math.min(iH + dy, window.innerHeight - iT - 2));
                if (currentDir.includes('w')) {
                    nW = Math.max(150, Math.min(iW - dx, iW + iL - 2));
                    if (nW > 150) nL = iL + dx;
                    if (nL < 0) { nW -= (0 - nL); nL = 0; }
                }
                if (currentDir.includes('n')) {
                    nH = Math.max(150, Math.min(iH - dy, iH + iT - 2));
                    if (nH > 150) nT = iT + dy;
                    if (nT < 0) { nH -= (0 - nT); nT = 0; }
                }

                previewContainer.style.width = nW + 'px';
                previewContainer.style.height = nH + 'px';
                previewContainer.style.left = nL + 'px';
                previewContainer.style.top = nT + 'px';
                const subTb = previewContainer.querySelector('.custom-native-toolbar');
                contentArea.style.height = (nH - header.offsetHeight - (subTb ? subTb.offsetHeight : 36)) + 'px';
            }
        };

        const handleUp = () => {
            isDragging = isResizing = false;
            dragOverlay.style.display = 'none';
            window.removeEventListener('mousemove', handleMove, true);
            window.removeEventListener('mouseup', handleUp, true);
        };

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('a, button')) return;
            e.preventDefault(); isDragging = true; sX = e.clientX; sY = e.clientY;
            const rect = previewContainer.getBoundingClientRect();
            iL = rect.left; iT = rect.top;
            Object.assign(previewContainer.style, { transform: 'none', left: iL + 'px', top: iT + 'px' });
            Object.assign(dragOverlay.style, { cursor: 'move', display: 'block' });
            window.addEventListener('mousemove', handleMove, true);
            window.addEventListener('mouseup', handleUp, true);
        });

        const dirs = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
        const cursors = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

        dirs.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `ui-resizable-handle ui-resizable-${dir}`;
            handle.style.cssText = `position:absolute; z-index:1000; cursor:${cursors[dir]};`;

            const size = '8px';
            if (dir.includes('n')) handle.style.top = '-4px';
            if (dir.includes('s')) handle.style.bottom = '-4px';
            if (dir.includes('e')) handle.style.right = '-4px';
            if (dir.includes('w')) handle.style.left = '-4px';

            if (dir === 'n' || dir === 's') { handle.style.left = '0'; handle.style.width = '100%'; handle.style.height = size; }
            if (dir === 'e' || dir === 'w') { handle.style.top = '0'; handle.style.height = '100%'; handle.style.width = size; }
            if (dir.length === 2) { handle.style.width = size; handle.style.height = size; }

            if (dir === 'se') {
                handle.classList.add('ui-icon', 'ui-icon-gripsmall-diagonal-se', 'ui-icon-grip-diagonal-se');
                handle.style.bottom = '3px';
                handle.style.right = '3px';
                handle.style.width = '14px';
                handle.style.height = '14px';
            }

            previewContainer.appendChild(handle);

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault(); e.stopPropagation(); isResizing = true; currentDir = dir; sX = e.clientX; sY = e.clientY;
                const rect = previewContainer.getBoundingClientRect();
                iW = rect.width; iH = rect.height; iL = rect.left; iT = rect.top;
                Object.assign(dragOverlay.style, { cursor: cursors[dir], display: 'block' });
                window.addEventListener('mousemove', handleMove, true);
                window.addEventListener('mouseup', handleUp, true);
            });
        });
    }

    function injectDynamicCSS() {
        const allExtClasses = Object.keys(extMap).map(ext => `.${ext}`).join(', ');
        if (!allExtClasses) return;
        const style = document.createElement('style');
        style.textContent = `
            .file-upload-submission:has(${allExtClasses}) .modal_preview_link { display: none !important; }
            #content.hide-native-preview #doc_preview, #content.hide-native-preview .viewerContainer { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    function injectPreviewButtons() {
        document.querySelectorAll('.file-upload-submission').forEach((sub) => {
            const attachmentDiv = sub.querySelector('.file-upload-submission-attachment');
            const linkTag = sub.querySelector('.file-upload-submission-info__link');
            if (!attachmentDiv || !linkTag || attachmentDiv.querySelector('.custom-preview-btn')) return;

            const filename = linkTag.innerText.trim(), url = linkTag.href;
            const fileInfo = getFileTypeInfo(filename);
            if (!fileInfo) return;

            const uniqueId = 'ui-id-custom-' + Math.floor(Math.random() * 10000);
            const btn = createEl('a', { innerText: i18n.btnText, href: '#', className: 'Button--link custom-preview-btn', role: 'button' }, 'cursor:pointer;margin-left:10px;');
            const overlay = createEl('div', { className: 'ui-widget-overlay' }, 'display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1001;');
            const previewContainer = createEl('div', { className: 'ui-dialog ui-widget ui-widget-content ui-corner-all ui-draggable ui-resizable' }, 'display:none;position:absolute;z-index:1002;outline:0;margin-bottom:30px;');

            previewContainer.setAttribute('tabindex', '-1'); previewContainer.setAttribute('role', 'dialog'); previewContainer.setAttribute('aria-labelledby', uniqueId);

            const header = createEl('div', { className: 'ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix ui-draggable-handle' }, 'position:relative; border-bottom:none; border-bottom-left-radius:0; border-bottom-right-radius:0;');
            const title = createEl('span', {
                id: uniqueId,
                className: 'ui-dialog-title',
                innerText: isZh ? `${filename}${i18n.titlePrefix}` : `${i18n.titlePrefix}${filename}`
            }, 'user-select:none; white-space:normal; word-break:break-word; display:block; padding-right:16px; line-height:1.4;');

            const closeBtn = createEl('a', { href: '#', className: 'ui-dialog-titlebar-close ui-corner-all', role: 'button', innerHTML: `<span class="ui-icon ui-icon-closethick">${isZh ? '關閉' : 'Close'}</span>` });
            closeBtn.onmouseenter = () => closeBtn.classList.add('ui-state-hover');
            closeBtn.onmouseleave = () => closeBtn.classList.remove('ui-state-hover');
            closeBtn.onclick = (e) => { e.preventDefault(); previewContainer.style.display = overlay.style.display = 'none'; contentArea.innerHTML = ''; };

            header.append(title, closeBtn);

            const subToolbar = createEl('div', { className: 'custom-native-toolbar' }, 'display:flex; justify-content:flex-end; align-items:center; padding:6px 4px 6px 15px; background:#f5f5f5; border-bottom:1px solid #ccc; border-top:1px solid #ddd; gap:4px; height:36px; box-sizing:border-box;');
            subToolbar.innerHTML = getToolbarHtml('modal');

            const { copyBtn, newTabBtn } = setupToolbarEvents(subToolbar, 'modal', url);

            const contentArea = createEl('div', { className: 'ui-dialog-content ui-widget-content' }, 'padding:0;overflow:hidden;width:auto;min-height:0;display:block;');
            const dragOverlay = createEl('div', {}, 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1004;display:none;');

            previewContainer.append(dragOverlay, header, subToolbar, contentArea);
            document.body.append(overlay, previewContainer);
            attachmentDiv.appendChild(btn);

            enableDragAndResize(previewContainer, header, dragOverlay, contentArea);

            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                const dW = Math.min(900, window.innerWidth * 0.95), dH = 585;
                Object.assign(previewContainer.style, { width: dW + 'px', left: Math.round((window.innerWidth - dW - 16) / 2) + 'px', top: (window.scrollY + 98) + 'px', height: dH + 'px', display: 'block' });
                overlay.style.display = 'block';
                contentArea.innerHTML = `<div style="padding:15px;color:#666;">${i18n.loading}</div>`;

                setTimeout(() => contentArea.style.height = (dH - (header.offsetHeight || 45) - (subToolbar.offsetHeight || 36)) + 'px', 0);
                generateAndInjectIframes(url, filename, fileInfo, contentArea, copyBtn, newTabBtn);
                setTimeout(() => previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
            };
        });

        const mainContent = document.querySelector('#content.ic-Layout-contentMain');
        if (mainContent && !mainContent.querySelector('.custom-auto-preview')) {
            const titleElement = mainContent.querySelector('h2'), downloadLink = mainContent.querySelector('a[download]');
            if (titleElement && downloadLink) {
                const filename = titleElement.innerText.trim(), fileInfo = getFileTypeInfo(filename);
                if (fileInfo) {
                    mainContent.classList.add('hide-native-preview');
                    autoInjectPreviewBox(mainContent, downloadLink.href, filename, fileInfo);
                }
            }
        }
    }

    function autoInjectPreviewBox(parent, url, filename, fileInfo) {
        const previewContainer = createEl('div', { className: 'custom-auto-preview' }, 'margin-top:20px;border:1px solid #ddd;border-radius:4px;background:#fff;height:600px;display:flex;flex-direction:column;overflow:hidden;position:relative;');
        const header = createEl('div', { className: 'custom-native-toolbar' }, 'display:flex; justify-content:flex-end; align-items:center; padding:6px 4px 6px 15px; background:#f5f5f5; border-bottom:1px solid #ddd; height:36px; box-sizing:border-box;');

        const btnContainer = createEl('div', {}, 'display:flex; align-items:center; gap:4px;');
        btnContainer.innerHTML = getToolbarHtml('auto');
        header.append(btnContainer);

        const { copyBtn, newTabBtn } = setupToolbarEvents(btnContainer, 'auto', url);
        const contentArea = createEl('div', {}, 'flex-grow:1;position:relative;');
        previewContainer.append(header, contentArea);

        const sf = parent.querySelector('#sequence_footer');
        sf ? parent.insertBefore(previewContainer, sf) : parent.appendChild(previewContainer);

        contentArea.innerHTML = `<div style="padding:20px;">${i18n.loading}</div>`;
        generateAndInjectIframes(url, filename, fileInfo, contentArea, copyBtn, newTabBtn);
    }

    function observeDOM() {
        injectPreviewButtons();
        let timeout = null;
        new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length > 0)) {
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(() => injectPreviewButtons(), 300);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    chrome.storage.sync.get(defaultSettings, (items) => {
        parseSettings(items);
        injectDynamicCSS();
        document.body ? observeDOM() : document.addEventListener('DOMContentLoaded', observeDOM);
    });
})();
