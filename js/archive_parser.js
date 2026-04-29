const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

const SUPPORTED_TEXT_EXTS = ['txt', 'md', 'csv', 'json', 'js', 'py', 'html', 'css', 'c', 'cpp', 'h', 'hpp', 'java', 'sh', 'v', 'sv', 'log', 'xml', 'ipynb'];
const SUPPORTED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const LANG_MAP = { py: 'python', v: 'verilog', sv: 'verilog', c: 'c', cpp: 'cpp', js: 'javascript', html: 'xml', css: 'css', json: 'json', md: 'markdown', sh: 'bash', java: 'java', m: 'matlab' };

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

function renderJupyterNotebook(content) {
    const data = JSON.parse(content);
    if (!data.cells || !Array.isArray(data.cells)) throw new Error("無效的 Jupyter Notebook 格式");
    
    return data.cells.map(cell => {
        const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
        
        if (cell.cell_type === 'markdown') {
            return `<div class="ipynb-markdown" style="margin-bottom:15px;line-height:1.6;font-family:sans-serif;">${window.marked ? marked.parse(source) : escapeHTML(source)}</div>`;
        }
        
        if (cell.cell_type === 'code') {
            let html = `<div class="ipynb-code" style="margin-bottom:15px;border:1px solid #e1e4e8;border-radius:6px;overflow:hidden;">
                <div style="background:#f6f8fa;padding:12px;border-bottom:1px solid #e1e4e8;display:flex;">
                    <div style="color:#24292e;font-family:monospace;font-size:12px;margin-right:10px;user-select:none;">In [${cell.execution_count || ' '}]:</div>
                    <pre style="margin:0;flex-grow:1;font-size:13px;white-space:pre-wrap;word-wrap:break-word;"><code class="language-python">${escapeHTML(source)}</code></pre>
                </div>`;
            
            if (cell.outputs && cell.outputs.length > 0) {
                html += `<div class="ipynb-outputs" style="padding:12px;background:#fff;font-family:monospace;font-size:13px;border-top:1px solid #eaecef;">`;
                cell.outputs.forEach(out => {
                    if (out.output_type === 'stream') {
                        const outText = Array.isArray(out.text) ? out.text.join('') : (out.text || '');
                        html += `<pre style="margin:0 0 8px 0;color:${out.name === 'stderr' ? '#cb2431' : '#24292e'};white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(outText)}</pre>`;
                    } else if (['execute_result', 'display_data'].includes(out.output_type) && out.data) {
                        if (out.data['image/png']) {
                            const b64 = Array.isArray(out.data['image/png']) ? out.data['image/png'].join('') : out.data['image/png'];
                            html += `<div style="margin-bottom:8px;"><img src="data:image/png;base64,${b64.replace(/\n/g, '')}" style="max-width:100%;height:auto;"></div>`;
                        } else if (out.data['image/jpeg']) {
                            const b64 = Array.isArray(out.data['image/jpeg']) ? out.data['image/jpeg'].join('') : out.data['image/jpeg'];
                            html += `<div style="margin-bottom:8px;"><img src="data:image/jpeg;base64,${b64.replace(/\n/g, '')}" style="max-width:100%;height:auto;"></div>`;
                        } else if (out.data['text/plain']) {
                            const outText = Array.isArray(out.data['text/plain']) ? out.data['text/plain'].join('') : (out.data['text/plain'] || '');
                            html += `<pre style="margin:0 0 8px 0;color:#24292e;white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(outText)}</pre>`;
                        }
                    } else if (out.output_type === 'error') {
                        const traceback = out.traceback ? out.traceback.join('\n').replace(/\u001b\[.*?m/g, '') : (out.evalue || '');
                        html += `<pre style="margin:0 0 8px 0;color:#cb2431;white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(traceback)}</pre>`;
                    }
                });
                html += `</div>`;
            }
            return html + `</div>`;
        }
        
        if (cell.cell_type === 'raw') {
            return `<div class="ipynb-raw" style="margin-bottom:15px;background:#f1f1f1;padding:10px;border-radius:4px;"><pre style="margin:0;font-size:13px;white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(source)}</pre></div>`;
        }
        
        return '';
    }).join('');
}

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
    const isText = SUPPORTED_TEXT_EXTS.includes(ext) || !path.includes('.');
    const isImage = SUPPORTED_IMAGE_EXTS.includes(ext);
    const isPdf = ext === 'pdf';
    const viewer = document.getElementById('archive-viewer-content');
    
    if (!isText && !isImage && !isPdf) {
        viewer.innerHTML = `<div style="padding:20px;text-align:center;color:#666;display:flex;align-items:center;justify-content:center;height:100%;">不支援預覽此格式的檔案：${escapeHTML(ext)}</div>`;
        return;
    }
    
    viewer.innerHTML = `<div style="padding:20px;color:#666;">讀取中...</div>`;
    
    try {
        const isMedia = isImage || isPdf;
        const data = await extractFileData(path, isMedia);

        if (isMedia) {
            const mimeType = isPdf ? 'application/pdf' : `image/${ext === 'svg' ? 'svg+xml' : ext}`;
            const blobUrl = URL.createObjectURL(new Blob([data], { type: mimeType }));
            
            if (isPdf) {
                viewer.innerHTML = `<div style="height:100%;box-sizing:border-box;"><iframe src="${blobUrl}" style="width:100%;height:100%;border:none;"></iframe></div>`;
            } else {
                viewer.innerHTML = `<div style="padding:20px;text-align:center;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;"><img src="${blobUrl}" style="max-width:100%;max-height:100%;border:1px solid #ddd;box-shadow:0 2px 4px rgba(0,0,0,0.1);"></div>`;
            }
        } else if (ext === 'ipynb') {
            viewer.innerHTML = `<div style="padding:20px;height:100%;box-sizing:border-box;overflow:auto;">${renderJupyterNotebook(data)}</div>`;
            if (window.hljs) {
                viewer.querySelectorAll('pre code').forEach(block => window.hljs.highlightElement(block));
            }
        } else {
            const langClass = LANG_MAP[ext] || ext;
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

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        viewer.style.pointerEvents = 'none';
        resizer.style.background = '#0066cc';
    });

    resizer.addEventListener('mouseover', () => {
        if (!isResizing) resizer.style.background = '#c8ccd1';
    });
    resizer.addEventListener('mouseout', () => {
        if (!isResizing) resizer.style.background = '#e1e4e8';
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
    const absoluteUrl = window.TARGET_URL || document.body.getAttribute('data-url');
    const ext = window.TARGET_EXT || document.body.getAttribute('data-ext');
    if (!absoluteUrl || !ext) return;
    window.TARGET_URL = absoluteUrl;
    window.TARGET_EXT = ext;
    
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
