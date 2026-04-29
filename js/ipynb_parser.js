const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

async function parseIpynb() {
    const absoluteUrl = window.TARGET_URL || document.body.getAttribute('data-url');
    if (!absoluteUrl) return;
    window.TARGET_URL = absoluteUrl;
    const renderContent = document.getElementById('render-content');
    
    try {
        const text = await (await fetch(window.TARGET_URL)).text();
        const data = JSON.parse(text);
        let html = '';
        
        if (!data.cells || !Array.isArray(data.cells)) {
            throw new Error("無效的 Jupyter Notebook 格式");
        }
        
        data.cells.forEach((cell, index) => {
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
                                    // Fallback to text/plain for safety
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
        
        renderContent.innerHTML = html;
        
        if (window.hljs) {
            renderContent.querySelectorAll('pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    } catch (e) {
        renderContent.innerHTML = `<div style="color:red;">解析失敗: ${escapeHTML(e.message)}</div>`;
    }
}

parseIpynb();
