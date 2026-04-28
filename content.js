const style = document.createElement('style');
style.textContent = `.file-upload-submission-info__link.zip::before{display:none !important}.file-upload-submission:has(.zip) .modal_preview_link{display:none !important}.file-upload-submission-info__link.zip{padding-left:0 !important;background-image:none !important}#content.hide-native-preview #doc_preview,#content.hide-native-preview .viewerContainer{display:none !important}`;
document.head.appendChild(style);

(function() {
    'use strict';

    const defaultSettings = {
        images: 'png, jpg, jpeg, gif, svg, webp',
        videos: 'mp4, webm, ogg, mov',
        audios: 'mp3, wav, ogg, m4a',
        codes: 'py, v, sv, c, cpp, js, html, css, json, md, sh, java, m',
        plaintext: 'txt, log, csv',
        archives: 'zip, tgz, gz',
        excels: 'xls, xlsx',
        powerpoints: 'ppt, pptx'
    };

    const langMap = { py: 'python', v: 'verilog', sv: 'verilog', c: 'c', cpp: 'cpp', js: 'javascript', html: 'xml', css: 'css', json: 'json', md: 'markdown', sh: 'bash', java: 'java', m: 'matlab' };
    let extMap = {};

    const isZh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    const i18n = {
        btnText: isZh ? '預覽' : 'Preview',
        titlePrefix: isZh ? ' 的預覽' : 'Preview of ',
        loading: isZh ? '正在讀取...' : 'Loading...',
        errorPrefix: isZh ? '讀取失敗: ' : 'Failed to load: ',
        copy: isZh ? '複製內容' : 'Copy',
        copied: isZh ? '已複製' : 'Copied',
        newTab: isZh ? '全螢幕' : 'Full Screen',
        download: isZh ? '下載' : 'Download'
    };

    const unifiedBtnStyle = 'font-size:13px;color:#333;text-decoration:none;font-weight:normal;cursor:pointer;background:none;border:none;padding:0;font-family:inherit;outline:none;';

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

    function generateViewerHTML(filename, fileInfo, absoluteUrl, textContent, isFullScreen) {
        let bodyHtml = '', extraDependencies = '', parserScript = '';
        const { category, ext, lang } = fileInfo;

        if (category === 'image') {
            bodyHtml = `<img src="${absoluteUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`;
        } else if (category === 'video' || category === 'audio') {
            bodyHtml = `<${category} src="${absoluteUrl}" controls style="max-width:100%;max-height:85vh;display:block;margin:0 auto;outline:none;"></${category}>`;
        } else if (category === 'archive') {
            const treeParserScript = `function buildTree(paths){const r={children:{}};paths.forEach(f=>{if(!f.path)return;const p=f.path.replace(/\\/$/,'').split('/');let c=r;for(let i=0;i<p.length;i++){const pt=p[i];if(!c.children[pt]){c.children[pt]={name:pt,isDir:i<p.length-1||f.isDir,size:i===p.length-1?f.size:0,children:{}};}else if(i===p.length-1){c.children[pt].isDir=f.isDir;c.children[pt].size=f.size;}c=c.children[pt];}});return r;}function renderTreeHTML(n,p=''){let h='';const k=Object.keys(n.children).sort((a,b)=>{const dA=n.children[a].isDir,dB=n.children[b].isDir;if(dA&&!dB)return -1;if(!dA&&dB)return 1;return a.localeCompare(b);});k.forEach((key,i)=>{const c=n.children[key],L=i===k.length-1,b=L?'└── ':'├── ',t=c.name+(c.isDir?'/':''),s=(!c.isDir&&c.size>0)?\` <span style="color:#888;font-size:12px;">(\${(c.size/1024).toFixed(1)} KB)</span>\`:'';h+=\`<div style="font-family:Consolas,monospace;font-size:14px;white-space:pre;line-height:1.6;color:#333;">\${p}\${b}\${t}\${s}</div>\`;h+=renderTreeHTML(c,p+(L?'    ':'│   '));});return h;}`;
            if (ext === 'zip') {
                extraDependencies = `<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>`;
                bodyHtml = `<div id="render-content"><div style="padding:15px;color:#666;">讀取 ZIP 結構中...</div></div>`;
                parserScript = `<script>${treeParserScript} async function parseFile(){try{const z=await JSZip.loadAsync(await(await fetch("${absoluteUrl}")).blob());let l=[];Object.keys(z.files).forEach(p=>{const e=z.files[p];l.push({path:p,isDir:e.dir,size:e._data?e._data.uncompressedSize:0})});document.getElementById('render-content').innerHTML='<div style="padding:20px;"><h3>Archive (.zip)</h3><div style="background:#f9f9f9;padding:15px;border-radius:6px;overflow-x:auto;">'+renderTreeHTML(buildTree(l))+'</div></div>';}catch(e){document.getElementById('render-content').innerHTML='<div style="color:red;padding:20px;">解析失敗。</div>';}}parseFile();</script>`;
            } else if (['tgz', 'gz'].includes(ext)) {
                extraDependencies = `<script src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"></script>`;
                bodyHtml = `<div id="render-content"><div style="padding:15px;color:#666;">解壓與讀取 TGZ 結構中...</div></div>`;
                parserScript = `<script>${treeParserScript} async function parseFile(){try{const d=pako.inflate(new Uint8Array(await(await fetch("${absoluteUrl}")).arrayBuffer()));let o=0,f=[];while(o<d.length){if(d[o]===0)break;let n="";for(let i=0;i<100;i++){if(d[o+i]===0)break;n+=String.fromCharCode(d[o+i]);}let s="";for(let i=124;i<136;i++){if(d[o+i]===0||d[o+i]===32)break;s+=String.fromCharCode(d[o+i]);}let sz=parseInt(s.trim()||"0",8);if(n)f.push({path:n,size:sz,isDir:(String.fromCharCode(d[o+156])==='5'||n.endsWith('/'))});o+=512+Math.ceil(sz/512)*512;}document.getElementById('render-content').innerHTML='<div style="padding:20px;"><h3>Archive (.tgz)</h3><div style="background:#f9f9f9;padding:15px;border-radius:6px;overflow-x:auto;">'+renderTreeHTML(buildTree(f))+'</div></div>';}catch(e){document.getElementById('render-content').innerHTML='<div style="color:red;padding:20px;">解析失敗。</div>';}}parseFile();</script>`;
            }
        } else if (category === 'excel') {
            extraDependencies = `<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>`;
            bodyHtml = `<div id="render-content" style="overflow-x:auto;padding:15px;">繪製表格中...</div>`;
            parserScript = `<script>async function parseFile(){try{const w=XLSX.read(await(await fetch("${absoluteUrl}")).arrayBuffer(),{type:'array'});let h='<div style="padding:15px;font-family:sans-serif;">';w.SheetNames.forEach(n=>{h+=\`<h3 style="color:#0099CC;margin-top:20px;">\${n}</h3>\`+XLSX.utils.sheet_to_html(w.Sheets[n])});document.getElementById('render-content').innerHTML=h+'</div>';document.querySelectorAll('table').forEach(t=>{t.style.borderCollapse='collapse';t.style.width='100%';t.querySelectorAll('th,td').forEach(c=>{c.style.border='1px solid #ddd';c.style.padding='8px';c.style.fontSize='13px';});t.querySelectorAll('th').forEach(c=>c.style.backgroundColor='#f2f2f2');});}catch(e){document.getElementById('render-content').innerHTML='<div style="color:red;">失敗: '+e.message+'</div>';}}parseFile();</script>`;
        } else if (category === 'powerpoint') {
            const eu = chrome.runtime.getURL('');
            extraDependencies = `<link rel="stylesheet" href="${eu}css/pptxjs.css"><link rel="stylesheet" href="${eu}css/nv.d3.min.css"><script src="${eu}js/jquery-1.11.3.min.js"></script><script src="${eu}js/jszip.min.js"></script><script src="${eu}js/filereader.js"></script><script src="${eu}js/d3.min.js"></script><script src="${eu}js/nv.d3.min.js"></script><script src="${eu}js/pptxjs.js"></script><script src="${eu}js/divs2slides.js"></script><style>html,body{margin:0;padding:0;overflow-x:hidden;background-color:transparent}#container{width:100%;overflow:hidden;padding-top:10px}#warper{margin:0;width:1280px}.slide{width:100%!important;margin:0!important;border:1px solid #ddd;box-shadow:0 4px 8px rgba(0,0,0,0.1);border-radius:4px;background:white}</style>`;
            bodyHtml = `<div id="container"><div id="warper"><div id="result"></div></div></div>`;
            parserScript = `<script>$(function(){$("#result").pptxToHtml({pptxFileUrl:"${absoluteUrl}",slideMode:!1,keyBoardShortCut:!1,slideModeConfig:{first:1,nav:!1,showPlayPauseBtn:!1,keyBoardShortCut:!1,showSlideNum:!1,showTotalSlideNum:!1,autoSlide:!1,randomAutoSlide:!1,loop:!1,background:"black",transition:"default",transitionTime:1}});function fitSlides(){var c=$('#container').width(),s=Math.min(1,c/1282);$('#warper').css({'transform':'scale('+s+')','transform-origin':'top left'});var h=$('#warper')[0].getBoundingClientRect().height;if(h>0)$('#container').css('height',(h+15)+'px');}$(window).on('resize',fitSlides);var l=setInterval(function(){if($('.slide').length>0){fitSlides();clearInterval(l);}},250);});</script>`;
        } else {
            bodyHtml = `<pre><code class="language-${lang}">${escapeHTML(textContent)}</code></pre>`;
        }

        const isCode = category === 'code';
        const codeDeps = isCode ? `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css"><script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/verilog.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/matlab.min.js"></script><style>pre{margin:0;font-size:14px;white-space:pre-wrap;word-wrap:break-word}</style>` : '';
        const initScript = isCode ? `<script>hljs.highlightAll();</script>` : '';

        if (!isFullScreen) {
            return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><style>body{margin:0;padding:15px;height:100%;overflow:auto;box-sizing:border-box;font-family:sans-serif;}</style>${codeDeps}${extraDependencies}</head><body>${bodyHtml}${initScript}${parserScript}</body></html>`;
        }

        return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>${filename}</title>${codeDeps}${extraDependencies}<style>body{margin:0;background:#525659;font-family:sans-serif;display:flex;flex-direction:column;height:100vh;overflow:hidden}.toolbar{background:#474747;height:32px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;z-index:100;flex-shrink:0}.toolbar-center{position:absolute;left:50%;transform:translateX(-50%);color:#f9f9fa;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40%}.toolbar-right{display:flex;align-items:center;gap:4px}.toolbarButton{background:none;border:none;color:#f9f9fa;height:26px;min-width:26px;padding:2px 6px;border-radius:2px;cursor:pointer;display:inline-flex;align-items:center;transition:background 0.2s}.toolbarButton:hover{background:hsla(0,0%,100%,.12)}.toolbarButton svg{width:14px;height:14px}.divider{width:1px;height:18px;background:rgba(255,255,255,0.2);margin:0 4px}.viewerContainer{flex-grow:1;overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start}.page{background:#fff;box-shadow:0 2px 5px rgba(0,0,0,0.2);padding:30px;transition:transform 0.15s;transform-origin:top center;min-width:60%;max-width:1200px;min-height:80vh;}</style></head><body><div class="toolbar"><div></div><div class="toolbar-center">${filename}</div><div class="toolbar-right">${isCode ? `<button id="fs-copy-btn" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/></svg><span style="font-size:12px;margin-left:6px">${i18n.copy}</span></button><div class="divider"></div>` : ''}<button id="zoomOut" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path d="M3.5 6.5A.5.5 0 0 1 4 6h5a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5z"/><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg></button><button id="zoomIn" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path d="M6.5 10a.5.5 0 0 1-.5-.5V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 1 0V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-.5.5z"/><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg></button><div class="divider"></div><button id="download" class="toolbarButton"><svg fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg></button></div></div><div class="viewerContainer"><div id="zoom-content" class="${['video','audio'].includes(category)?'':'page'}">${bodyHtml}</div></div>${initScript}${parserScript}<script>const cb=document.getElementById('fs-copy-btn');if(cb){const ot=cb.querySelector('span').innerText;cb.onclick=async()=>{try{cb.querySelector('span').innerText='...';await navigator.clipboard.writeText(await(await fetch("${absoluteUrl}")).text());cb.querySelector('span').innerText='${i18n.copied}';setTimeout(()=>cb.querySelector('span').innerText=ot,2000);}catch(e){}};}const db=document.getElementById('download');if(db){db.onclick=()=>{let u="${absoluteUrl}";if(!u.includes('download_frd=1'))u+=u.includes('?')?'&download_frd=1':'?download_frd=1';const a=document.createElement('a');a.href=u;a.target='_blank';a.click();};}let sc=1;const zc=document.getElementById('zoom-content');document.getElementById('zoomIn').onclick=()=>{sc+=0.15;zc.style.transform=\`scale(\${sc})\`;};document.getElementById('zoomOut').onclick=()=>{sc=Math.max(0.2,sc-0.15);zc.style.transform=\`scale(\${sc})\`;};</script></body></html>`;
    }

    async function generateAndInjectIframes(url, filename, fileInfo, contentArea, copyBtn, newTabBtn) {
        const absoluteUrl = new URL(url, window.location.href).href;
        let textContent = '';

        if (fileInfo.category === 'code') {
            try {
                textContent = await (await fetch(absoluteUrl)).text();
                if (copyBtn) {
                    copyBtn.style.display = 'inline-block';
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(textContent).then(() => {
                            const ot = copyBtn.innerText;
                            copyBtn.innerText = i18n.copied; copyBtn.style.color = '#0099CC';
                            setTimeout(() => { copyBtn.innerText = ot; copyBtn.style.color = '#333'; }, 2000);
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

    function enableDragAndResize(previewContainer, header, resizeHandle, dragOverlay, contentArea) {
        let isDragging = false, isResizing = false, sX, sY, iL, iT, iW, iH;

        const handleMove = (e) => {
            if (isDragging) {
                const nL = Math.max(0, Math.min(iL + (e.clientX - sX), window.innerWidth - previewContainer.offsetWidth));
                const nT = Math.max(0, Math.min(iT + (e.clientY - sY), window.innerHeight - previewContainer.offsetHeight));
                previewContainer.style.left = nL + 'px'; previewContainer.style.top = nT + 'px';
            } else if (isResizing) {
                const nW = Math.max(300, Math.min(iW + (e.clientX - sX), window.innerWidth - previewContainer.offsetLeft - 2));
                const nH = Math.max(200, Math.min(iH + (e.clientY - sY), window.innerHeight - previewContainer.offsetTop - 2));
                previewContainer.style.width = nW + 'px'; previewContainer.style.height = nH + 'px';
                contentArea.style.height = (nH - header.offsetHeight) + 'px';
            }
        };

        const handleUp = () => {
            isDragging = isResizing = false;
            dragOverlay.style.display = 'none';
            window.removeEventListener('mousemove', handleMove, true);
            window.removeEventListener('mouseup', handleUp, true);
        };

        header.addEventListener('mousedown', (e) => {
            if (['a', 'span', 'button', 'svg', 'path'].includes(e.target.tagName.toLowerCase())) return;
            e.preventDefault(); isDragging = true; sX = e.clientX; sY = e.clientY;
            const rect = previewContainer.getBoundingClientRect();
            iL = rect.left; iT = rect.top;
            Object.assign(previewContainer.style, { transform: 'none', left: iL + 'px', top: iT + 'px' });
            Object.assign(dragOverlay.style, { cursor: 'move', display: 'block' });
            window.addEventListener('mousemove', handleMove, true);
            window.addEventListener('mouseup', handleUp, true);
        });

        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation(); isResizing = true; sX = e.clientX; sY = e.clientY;
            iW = previewContainer.offsetWidth; iH = previewContainer.offsetHeight;
            Object.assign(dragOverlay.style, { cursor: 'se-resize', display: 'block' });
            window.addEventListener('mousemove', handleMove, true);
            window.addEventListener('mouseup', handleUp, true);
        });
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

            const header = createEl('div', { className: 'ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix ui-draggable-handle' }, 'position:relative;');
            const title = createEl('span', { id: uniqueId, className: 'ui-dialog-title', innerText: isZh ? `${filename}${i18n.titlePrefix}` : `${i18n.titlePrefix}${filename}` });
            const actionContainer = createEl('div', {}, 'position:absolute;right:45px;top:50%;transform:translateY(-50%);display:flex;gap:15px;align-items:center;');
            
            const copyBtn = createEl('button', { innerText: i18n.copy }, unifiedBtnStyle);
            const newTabBtn = createEl('a', { innerText: i18n.newTab }, unifiedBtnStyle);
            [copyBtn, newTabBtn].forEach(b => {
                b.onmouseenter = () => b.style.textDecoration = 'underline';
                b.onmouseleave = () => b.style.textDecoration = 'none';
            });

            const closeBtn = createEl('a', { href: '#', className: 'ui-dialog-titlebar-close ui-corner-all', role: 'button', innerHTML: `<span class="ui-icon ui-icon-closethick">${isZh ? '關閉' : 'Close'}</span>` });
            closeBtn.onmouseenter = () => closeBtn.classList.add('ui-state-hover');
            closeBtn.onmouseleave = () => closeBtn.classList.remove('ui-state-hover');
            closeBtn.onclick = (e) => { e.preventDefault(); previewContainer.style.display = overlay.style.display = 'none'; contentArea.innerHTML = ''; };

            actionContainer.append(copyBtn, newTabBtn);
            header.append(title, actionContainer, closeBtn);

            const contentArea = createEl('div', { className: 'ui-dialog-content ui-widget-content' }, 'padding:0;overflow:hidden;width:auto;min-height:0;display:block;');
            const dragOverlay = createEl('div', {}, 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1004;display:none;');
            const resizeHandle = createEl('div', {}, 'position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:se-resize;z-index:1005;background:linear-gradient(135deg, transparent 50%, #999 50%);opacity:0.8;');
            
            resizeHandle.onmouseenter = () => resizeHandle.style.opacity = '1';
            resizeHandle.onmouseleave = () => resizeHandle.style.opacity = '0.8';

            previewContainer.append(dragOverlay, header, contentArea, resizeHandle);
            document.body.append(overlay, previewContainer);
            attachmentDiv.appendChild(btn);

            enableDragAndResize(previewContainer, header, resizeHandle, dragOverlay, contentArea);

            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                const dW = Math.min(900, window.innerWidth * 0.95), dH = 585;
                Object.assign(previewContainer.style, { width: dW + 'px', left: Math.round((window.innerWidth - dW - 16) / 2) + 'px', top: (window.scrollY + 98) + 'px', height: dH + 'px', display: 'block' });
                overlay.style.display = 'block';
                contentArea.innerHTML = `<div style="padding:15px;color:#666;">${i18n.loading}</div>`;
                
                setTimeout(() => contentArea.style.height = (dH - (header.offsetHeight || 45)) + 'px', 0);
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
        const header = createEl('div', { innerHTML: `<span></span>` }, 'background:#f5f5f5;padding:8px 15px;border-bottom:1px solid #ddd;font-size:14px;display:flex;justify-content:space-between;align-items:center;');
        const fsBtn = createEl('a', { innerText: i18n.newTab }, 'font-size:12px;cursor:pointer;color:#000;text-decoration:none;');
        const contentArea = createEl('div', {}, 'flex-grow:1;position:relative;');

        header.appendChild(fsBtn);
        previewContainer.append(header, contentArea);
        
        const sf = parent.querySelector('#sequence_footer');
        sf ? parent.insertBefore(previewContainer, sf) : parent.appendChild(previewContainer);

        contentArea.innerHTML = `<div style="padding:20px;">${i18n.loading}</div>`;
        generateAndInjectIframes(url, filename, fileInfo, contentArea, null, fsBtn);
    }

    function observeDOM() {
        injectPreviewButtons();
        new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length > 0)) injectPreviewButtons();
        }).observe(document.body, { childList: true, subtree: true });
    }

    chrome.storage.sync.get(defaultSettings, (items) => {
        parseSettings(items);
        document.body ? observeDOM() : document.addEventListener('DOMContentLoaded', observeDOM);
    });
})();