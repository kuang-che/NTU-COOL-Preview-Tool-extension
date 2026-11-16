const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// 可預覽的類型跟隨使用者的設定：content.js 經 window.PV.types 傳入「副檔名 → { category, lang }」。
// PDF 不在設定裡（使用者無法調整），一律可預覽；沒有副檔名的檔案當成純文字。
const TYPES = (window.PV && window.PV.types) || {};
const PREVIEWABLE = ['code', 'jupyter', 'image', 'video', 'audio', 'pdf'];
const MIME = { pdf: 'application/pdf', svg: 'image/svg+xml', jpg: 'image/jpeg', mov: 'video/quicktime', mp3: 'audio/mpeg', m4a: 'audio/mp4' };
const typeOf = (path, ext) => ext === 'pdf' ? { category: 'pdf' }
    : path.split('/').pop().includes('.') ? TYPES[ext] : { category: 'code', lang: 'plaintext' };

window.archiveData = {
    type: null,
    zipInstance: null,
    tgzData: null,
    files: []
};

function buildTree(paths) {
    const root = { children: {} };
    paths.forEach(file => {
        if (!file.path) return;
        const parts = file.path.replace(/\/$/, '').split('/');
        let current = root;
        parts.forEach((part, index) => {
            if (!current.children[part]) {
                current.children[part] = {
                    name: part,
                    isDir: index < parts.length - 1 || file.isDir,
                    size: index === parts.length - 1 ? file.size : 0,
                    children: {},
                    fullPath: file.path
                };
            } else if (index === parts.length - 1) {
                Object.assign(current.children[part], { isDir: file.isDir, size: file.size, fullPath: file.path });
            }
            current = current.children[part];
        });
    });
    return root;
}

function renderTreeHTML(node, prefix = '') {
    let html = '';
    const keys = Object.keys(node.children).sort((a, b) => {
        const dirA = node.children[a].isDir, dirB = node.children[b].isDir;
        if (dirA !== dirB) return dirA ? -1 : 1;
        return a.localeCompare(b);
    });

    keys.forEach((key, index) => {
        const child = node.children[key];
        const isLast = index === keys.length - 1;
        const branch = isLast ? '└── ' : '├── ';
        const sizeStr = (!child.isDir && child.size > 0) ? ` <span style="color:#888;font-size:12px;">(${(child.size / 1024).toFixed(1)} KB)</span>` : '';
        
        let title = escapeHTML(child.name) + (child.isDir ? '/' : '');
        if (!child.isDir) {
            title = `<a href="#" class="archive-file-link" data-path="${escapeHTML(child.fullPath)}" style="color:#0066cc;text-decoration:none;" title="點擊預覽">${title}</a>`;
        }
        
        html += `<div style="font-family:Consolas,monospace;font-size:14px;white-space:pre;line-height:1.6;color:#333;">${prefix}${branch}${title}${sizeStr}</div>`;
        html += renderTreeHTML(child, prefix + (isLast ? '    ' : '│   '));
    });
    return html;
}

// Notebook 的渲染在 ipynb_parser.js（window.renderJupyterNotebook），兩處共用同一份

async function extractFileData(path, isMedia) {
    if (window.archiveData.type === 'zip') {
        const fileInfo = window.archiveData.zipInstance.files[path];
        return await fileInfo.async(isMedia ? 'uint8array' : 'text');
    } else if (window.archiveData.type === 'tgz') {
        const fileInfo = window.archiveData.files.find(f => f.path === path);
        if (!fileInfo || fileInfo.dataOffset === undefined) throw new Error('找不到檔案資料');
        const chunk = window.archiveData.tgzData.slice(fileInfo.dataOffset, fileInfo.dataOffset + fileInfo.size);
        return isMedia ? chunk : new TextDecoder().decode(chunk);
    }
    throw new Error('未知的壓縮檔類型');
}

async function handleFileClick(e) {
    e.preventDefault();
    const path = e.target.getAttribute('data-path');
    if (!path) return;
    
    document.querySelectorAll('.archive-file-link').forEach(el => el.style.fontWeight = 'normal');
    e.target.style.fontWeight = 'bold';

    const ext = path.split('.').pop().toLowerCase();
    const type = typeOf(path, ext) || {}, category = type.category;
    const isPdf = category === 'pdf', isImage = category === 'image';
    const viewer = document.getElementById('archive-viewer-content');

    if (!PREVIEWABLE.includes(category)) {
        viewer.innerHTML = `<div style="padding:20px;text-align:center;color:#666;display:flex;align-items:center;justify-content:center;height:100%;">不支援預覽此格式的檔案：${escapeHTML(ext)}</div>`;
        return;
    }
    
    viewer.innerHTML = `<div style="padding:20px;color:#666;">讀取中...</div>`;
    
    try {
        const isMedia = category !== 'code' && category !== 'jupyter';
        const data = await extractFileData(path, isMedia);

        if (isMedia) {
            const blobUrl = URL.createObjectURL(new Blob([data], { type: MIME[ext] || `${category}/${ext}` }));
            const centered = 'padding:20px;text-align:center;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;';

            if (isPdf) {
                viewer.innerHTML = `<div style="height:100%;box-sizing:border-box;"><iframe src="${blobUrl}" style="width:100%;height:100%;border:none;"></iframe></div>`;
            } else if (isImage) {
                viewer.innerHTML = `<div style="${centered}"><img src="${blobUrl}" style="max-width:100%;max-height:100%;border:1px solid #ddd;box-shadow:0 2px 4px rgba(0,0,0,0.1);"></div>`;
            } else {
                viewer.innerHTML = `<div style="${centered}"><${category} src="${blobUrl}" controls style="max-width:100%;max-height:100%;outline:none;"></${category}></div>`;
            }
        } else if (category === 'jupyter') {
            viewer.innerHTML = `<div style="padding:20px;height:100%;box-sizing:border-box;overflow:auto;">${renderJupyterNotebook(data)}</div>`;
            if (window.hljs) {
                viewer.querySelectorAll('pre code').forEach(block => window.hljs.highlightElement(block));
            }
        } else {
            const langClass = type.lang;
            viewer.innerHTML = `<pre style="margin:0;padding:15px;font-size:14px;white-space:pre-wrap;word-wrap:break-word;background:#f6f8fa;height:100%;box-sizing:border-box;overflow:auto;"><code class="language-${langClass}">${escapeHTML(data)}</code></pre>`;
            if (window.hljs && data.length < 100000) {
                window.hljs.highlightElement(viewer.querySelector('code'));
            }
        }
    } catch (err) {
        viewer.innerHTML = `<div style="padding:20px;color:red;">讀取失敗: ${escapeHTML(err.message)}</div>`;
    }
}

function setupResizer() {
    const sidebar = document.getElementById('archive-sidebar');
    const resizer = document.getElementById('archive-resizer');
    const viewer = document.getElementById('archive-viewer-content');
    const container = document.getElementById('archive-container');
    let isResizing = false;

    // 滑過變色用事件監聽，不用行內的 onmouseover（行內事件處理器不符合擴充功能的內容安全政策）
    resizer.addEventListener('mouseover', () => { if (!isResizing) resizer.style.background = '#c8ccd1'; });
    resizer.addEventListener('mouseout', () => { if (!isResizing) resizer.style.background = '#e1e4e8'; });

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        viewer.style.pointerEvents = 'none';
        resizer.style.background = '#0066cc';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = container.getBoundingClientRect();
        let newWidth = Math.max(0, Math.min(e.clientX - containerRect.left, container.clientWidth - 5));
        sidebar.style.width = newWidth + 'px';
    });

    window.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            viewer.style.pointerEvents = 'auto';
            resizer.style.background = '#e1e4e8';
        }
    });
}

async function parseArchiveFile() {
    if (!window.TARGET_URL || !window.TARGET_EXT) return;
    const { TARGET_URL: absoluteUrl, TARGET_EXT: ext } = window;
    
    document.getElementById('render-content').innerHTML = `
        <div id="archive-container" style="display:flex;width:1600px;max-width:100%;box-sizing:border-box;height:75vh;min-height:450px;overflow:hidden;font-family:sans-serif;border:1px solid #ddd;border-radius:4px;position:relative;margin:0 auto;">
            <div id="archive-sidebar" style="width:300px;min-width:150px;max-width:80%;display:flex;flex-direction:column;background:#f9f9f9;overflow:hidden;flex-shrink:0;">
                <div style="padding:15px 15px 10px;border-bottom:1px solid #eee;font-weight:bold;color:#333;background:#f1f1f1;position:sticky;top:0;z-index:1;">檔案</div>
                <div id="archive-tree" style="flex-grow:1;padding:15px;overflow:auto;">讀取中...</div>
            </div>
            <div id="archive-resizer" style="width:5px;background:#e1e4e8;cursor:col-resize;flex-shrink:0;transition:background 0.2s;z-index:10;border-left:1px solid #ddd;border-right:1px solid #ddd;"></div>
            <div id="archive-viewer-content" style="flex: 1 1 0%;background:#fff;overflow:auto;position:relative;min-width:150px;">
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#999;font-size:14px;">點擊左側支援的檔案進行預覽</div>
            </div>
        </div>
    `;

    setupResizer();

    try {
        const buffer = await (await fetch(absoluteUrl)).arrayBuffer();

        if (ext === 'zip') {
            window.archiveData.type = 'zip';
            const z = await JSZip.loadAsync(buffer);
            window.archiveData.zipInstance = z;
            window.archiveData.files = Object.keys(z.files).map(path => ({
                path,
                isDir: z.files[path].dir,
                size: z.files[path]._data ? z.files[path]._data.uncompressedSize : 0
            }));
        } else if (['tgz', 'gz'].includes(ext)) {
            window.archiveData.type = 'tgz';
            const d = pako.inflate(new Uint8Array(buffer));
            window.archiveData.tgzData = d;
            
            let offset = 0;
            const files = [];
            
            while (offset < d.length) {
                if (d[offset] === 0) break;
                
                let name = "";
                for (let i = 0; i < 100 && d[offset + i] !== 0; i++) {
                    name += String.fromCharCode(d[offset + i]);
                }
                
                let sizeStr = "";
                for (let i = 124; i < 136 && d[offset + i] !== 0 && d[offset + i] !== 32; i++) {
                    sizeStr += String.fromCharCode(d[offset + i]);
                }
                
                const size = parseInt(sizeStr.trim() || "0", 8);
                if (name) {
                    const isDir = String.fromCharCode(d[offset + 156]) === '5' || name.endsWith('/');
                    files.push({ path: name, size, isDir, dataOffset: offset + 512 });
                }
                offset += 512 + Math.ceil(size / 512) * 512;
            }
            window.archiveData.files = files;
        }

        document.getElementById('archive-tree').innerHTML = renderTreeHTML(buildTree(window.archiveData.files));
        document.querySelectorAll('.archive-file-link').forEach(el => el.addEventListener('click', handleFileClick));

    } catch (e) {
        document.getElementById('archive-tree').innerHTML = `<div style="color:red;">解析失敗: ${escapeHTML(e.message)}</div>`;
    }
}

parseArchiveFile();
