const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

window.archiveData = {
    type: null, // 'zip' or 'tgz'
    zipInstance: null,
    tgzData: null, // Uint8Array
    files: [] // {path, isDir, size, offset (for tgz)}
};

function buildTree(paths) {
    const r = { children: {} };
    paths.forEach(f => {
        if (!f.path) return;
        const p = f.path.replace(/\/$/, '').split('/');
        let c = r;
        for (let i = 0; i < p.length; i++) {
            const pt = p[i];
            if (!c.children[pt]) {
                c.children[pt] = { name: pt, isDir: i < p.length - 1 || f.isDir, size: i === p.length - 1 ? f.size : 0, children: {}, fullPath: f.path };
            } else if (i === p.length - 1) {
                c.children[pt].isDir = f.isDir;
                c.children[pt].size = f.size;
                c.children[pt].fullPath = f.path;
            }
            c = c.children[pt];
        }
    });
    return r;
}

function renderTreeHTML(n, p = '') {
    let h = '';
    const k = Object.keys(n.children).sort((a, b) => {
        const dA = n.children[a].isDir, dB = n.children[b].isDir;
        if (dA && !dB) return -1;
        if (!dA && dB) return 1;
        return a.localeCompare(b);
    });
    k.forEach((key, i) => {
        const c = n.children[key], L = i === k.length - 1, b = L ? '└── ' : '├── ';
        const s = (!c.isDir && c.size > 0) ? ` <span style="color:#888;font-size:12px;">(${(c.size / 1024).toFixed(1)} KB)</span>` : '';
        
        let t = escapeHTML(c.name) + (c.isDir ? '/' : '');
        if (!c.isDir) {
            // Make it a clickable link
            t = `<a href="#" class="archive-file-link" data-path="${escapeHTML(c.fullPath)}" style="color:#0066cc;text-decoration:none;" title="點擊預覽">${t}</a>`;
        }
        
        h += `<div style="font-family:Consolas,monospace;font-size:14px;white-space:pre;line-height:1.6;color:#333;">${p}${b}${t}${s}</div>`;
        h += renderTreeHTML(c, p + (L ? '    ' : '│   '));
    });
    return h;
}

const SUPPORTED_TEXT_EXTS = ['txt', 'md', 'csv', 'json', 'js', 'py', 'html', 'css', 'c', 'cpp', 'h', 'hpp', 'java', 'sh', 'v', 'sv', 'log', 'xml', 'ipynb'];
const SUPPORTED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const LANG_MAP = { py: 'python', v: 'verilog', sv: 'verilog', c: 'c', cpp: 'cpp', js: 'javascript', html: 'xml', css: 'css', json: 'json', md: 'markdown', sh: 'bash', java: 'java', m: 'matlab' };

async function handleFileClick(e) {
    e.preventDefault();
    const path = e.target.getAttribute('data-path');
    if (!path) return;
    
    // Highlight selected link
    document.querySelectorAll('.archive-file-link').forEach(el => el.style.fontWeight = 'normal');
    e.target.style.fontWeight = 'bold';

    const ext = path.split('.').pop().toLowerCase();
    const isText = SUPPORTED_TEXT_EXTS.includes(ext) || ext === path.toLowerCase() /* no extension, treat as text */;
    const isImage = SUPPORTED_IMAGE_EXTS.includes(ext);
    
    if (!isText && !isImage) {
        alert('不支援預覽此格式的檔案：' + ext);
        return;
    }

    const viewer = document.getElementById('archive-viewer-content');
    viewer.innerHTML = '<div style="padding:20px;color:#666;">讀取檔案中...</div>';

    try {
        let content = null;
        let isBase64 = false;

        if (window.archiveData.type === 'zip') {
            const file = window.archiveData.zipInstance.files[path];
            if (!file) throw new Error('找不到檔案');
            if (isImage) {
                const b64 = await file.async('base64');
                content = `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${b64}`;
                isBase64 = true;
            } else {
                content = await file.async('text');
            }
        } else if (window.archiveData.type === 'tgz') {
            const fileInfo = window.archiveData.files.find(f => f.path === path);
            if (!fileInfo || fileInfo.dataOffset === undefined) throw new Error('找不到檔案資料');
            const chunk = window.archiveData.tgzData.slice(fileInfo.dataOffset, fileInfo.dataOffset + fileInfo.size);
            
            if (isImage) {
                const blob = new Blob([chunk], { type: `image/${ext === 'svg' ? 'svg+xml' : ext}` });
                content = URL.createObjectURL(blob);
                isBase64 = true;
            } else {
                content = new TextDecoder().decode(chunk);
            }
        }

        if (isBase64) {
            viewer.innerHTML = `<div style="padding:20px;text-align:center;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;"><img src="${content}" style="max-width:100%;max-height:100%;border:1px solid #ddd;box-shadow:0 2px 4px rgba(0,0,0,0.1);"></div>`;
        } else if (ext === 'ipynb') {
            try {
                const data = JSON.parse(content);
                let html = '';
                if (!data.cells || !Array.isArray(data.cells)) throw new Error("無效的 Jupyter Notebook 格式");
                
                data.cells.forEach(cell => {
                    if (cell.cell_type === 'markdown') {
                        const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
                        html += `<div class="ipynb-markdown" style="margin-bottom:15px;line-height:1.6;font-family:sans-serif;">${window.marked ? marked.parse(source) : escapeHTML(source)}</div>`;
                    } else if (cell.cell_type === 'code') {
                        const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
                        html += `<div class="ipynb-code" style="margin-bottom:15px;border:1px solid #e1e4e8;border-radius:6px;overflow:hidden;">
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
                                } else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
                                    if (out.data) {
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
                                    }
                                } else if (out.output_type === 'error') {
                                    const traceback = out.traceback ? out.traceback.join('\n').replace(/\u001b\[.*?m/g, '') : (out.evalue || '');
                                    html += `<pre style="margin:0 0 8px 0;color:#cb2431;white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(traceback)}</pre>`;
                                }
                            });
                            html += `</div>`;
                        }
                        html += `</div>`;
                    } else if (cell.cell_type === 'raw') {
                        const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
                        html += `<div class="ipynb-raw" style="margin-bottom:15px;background:#f1f1f1;padding:10px;border-radius:4px;"><pre style="margin:0;font-size:13px;white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(source)}</pre></div>`;
                    }
                });
                viewer.innerHTML = `<div style="padding:20px;height:100%;box-sizing:border-box;overflow:auto;">${html}</div>`;
                if (window.hljs) {
                    viewer.querySelectorAll('pre code').forEach(block => window.hljs.highlightElement(block));
                }
            } catch (err) {
                viewer.innerHTML = `<div style="padding:20px;color:red;">Notebook 解析失敗: ${escapeHTML(err.message)}</div>`;
            }
        } else {
            const langClass = LANG_MAP[ext] || ext;
            viewer.innerHTML = `<pre style="margin:0;padding:15px;font-size:14px;white-space:pre-wrap;word-wrap:break-word;background:#f6f8fa;height:100%;box-sizing:border-box;overflow:auto;"><code class="language-${langClass}">${escapeHTML(content)}</code></pre>`;
            if (window.hljs) {
                window.hljs.highlightElement(viewer.querySelector('code'));
            }
        }
    } catch (err) {
        viewer.innerHTML = `<div style="padding:20px;color:red;">讀取失敗: ${escapeHTML(err.message)}</div>`;
    }
}

async function parseArchiveFile() {
    if (!window.TARGET_URL || !window.TARGET_EXT) return;
    const absoluteUrl = window.TARGET_URL;
    const ext = window.TARGET_EXT;
    
    document.getElementById('render-content').innerHTML = `
        <div style="display:flex;height:75vh;min-height:450px;overflow:hidden;font-family:sans-serif;border:1px solid #ddd;border-radius:4px;">
            <div style="width:300px;min-width:200px;border-right:1px solid #ddd;display:flex;flex-direction:column;background:#f9f9f9;resize:horizontal;overflow:auto;">
                <div style="padding:15px 15px 10px;border-bottom:1px solid #eee;font-weight:bold;color:#333;background:#f1f1f1;position:sticky;top:0;">目錄樹</div>
                <div id="archive-tree" style="flex-grow:1;padding:15px;overflow:auto;">讀取中...</div>
            </div>
            <div id="archive-viewer-content" style="flex-grow:1;background:#fff;overflow:auto;position:relative;">
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#999;font-size:14px;">點擊左側支援的檔案進行預覽</div>
            </div>
        </div>
    `;

    try {
        if (ext === 'zip') {
            window.archiveData.type = 'zip';
            const z = await JSZip.loadAsync(await (await fetch(absoluteUrl)).blob());
            window.archiveData.zipInstance = z;
            let l = [];
            Object.keys(z.files).forEach(p => {
                const e = z.files[p];
                l.push({ path: p, isDir: e.dir, size: e._data ? e._data.uncompressedSize : 0 });
            });
            window.archiveData.files = l;
            document.getElementById('archive-tree').innerHTML = renderTreeHTML(buildTree(l));
        } else if (['tgz', 'gz'].includes(ext)) {
            window.archiveData.type = 'tgz';
            const d = pako.inflate(new Uint8Array(await (await fetch(absoluteUrl)).arrayBuffer()));
            window.archiveData.tgzData = d;
            let o = 0, f = [];
            while (o < d.length) {
                if (d[o] === 0) break;
                let n = "";
                for (let i = 0; i < 100; i++) {
                    if (d[o + i] === 0) break;
                    n += String.fromCharCode(d[o + i]);
                }
                let s = "";
                for (let i = 124; i < 136; i++) {
                    if (d[o + i] === 0 || d[o + i] === 32) break;
                    s += String.fromCharCode(d[o + i]);
                }
                let sz = parseInt(s.trim() || "0", 8);
                if (n) {
                    const isDir = (String.fromCharCode(d[o + 156]) === '5' || n.endsWith('/'));
                    f.push({ path: n, size: sz, isDir: isDir, dataOffset: o + 512 });
                }
                o += 512 + Math.ceil(sz / 512) * 512;
            }
            window.archiveData.files = f;
            document.getElementById('archive-tree').innerHTML = renderTreeHTML(buildTree(f));
        }

        document.querySelectorAll('.archive-file-link').forEach(el => {
            el.addEventListener('click', handleFileClick);
        });

    } catch (e) {
        document.getElementById('archive-tree').innerHTML = `<div style="color:red;">解析失敗: ${escapeHTML(e.message)}</div>`;
    }
}

parseArchiveFile();
