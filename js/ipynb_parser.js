// Jupyter Notebook 的渲染。壓縮檔預覽（archive_parser.js）也共用 window.renderJupyterNotebook。
(() => {
    const escapeHTML = (str) => !str ? '' : str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const joined = (value) => Array.isArray(value) ? value.join('') : (value || '');
    const pre = (text, color, margin = '0 0 8px 0') => `<pre style="margin:${margin};color:${color};white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(text)}</pre>`;

    function renderOutput(out) {
        if (out.output_type === 'stream') return pre(joined(out.text), out.name === 'stderr' ? '#cb2431' : '#24292e');
        if (out.output_type === 'error') return pre(out.traceback ? out.traceback.join('\n').replace(/\u001b\[.*?m/g, '') : (out.evalue || ''), '#cb2431');
        if (!['execute_result', 'display_data'].includes(out.output_type) || !out.data) return '';
        const image = ['image/png', 'image/jpeg'].find(type => out.data[type]);
        if (image) return `<div style="margin-bottom:8px;"><img src="data:${image};base64,${joined(out.data[image]).replace(/\n/g, '')}" style="max-width:100%;height:auto;"></div>`;
        return out.data['text/plain'] ? pre(joined(out.data['text/plain']), '#24292e') : '';
    }

    // content：.ipynb 檔的文字內容；回傳整份 Notebook 的 HTML
    window.renderJupyterNotebook = (content) => {
        const data = JSON.parse(content);
        if (!Array.isArray(data.cells)) throw new Error('無效的 Jupyter Notebook 格式');

        return data.cells.map(cell => {
            const source = joined(cell.source);
            if (cell.cell_type === 'markdown') {
                return `<div class="ipynb-markdown" style="margin-bottom:15px;line-height:1.6;font-family:sans-serif;">${window.marked ? marked.parse(source) : escapeHTML(source)}</div>`;
            }
            if (cell.cell_type === 'raw') {
                return `<div class="ipynb-raw" style="margin-bottom:15px;background:#f1f1f1;padding:10px;border-radius:4px;"><pre style="margin:0;font-size:13px;white-space:pre-wrap;word-wrap:break-word;">${escapeHTML(source)}</pre></div>`;
            }
            if (cell.cell_type !== 'code') return '';
            const outputs = (cell.outputs || []).map(renderOutput).join('');
            return `<div class="ipynb-code" style="margin-bottom:15px;border:1px solid #e1e4e8;border-radius:6px;overflow:hidden;">
                <div style="background:#f6f8fa;padding:12px;border-bottom:1px solid #e1e4e8;display:flex;">
                    <div style="color:#24292e;font-family:monospace;font-size:12px;margin-right:10px;user-select:none;">In [${cell.execution_count || ' '}]:</div>
                    <pre style="margin:0;flex-grow:1;font-size:13px;white-space:pre-wrap;word-wrap:break-word;"><code class="language-python">${escapeHTML(source)}</code></pre>
                </div>${cell.outputs && cell.outputs.length ? `<div class="ipynb-outputs" style="padding:12px;background:#fff;font-family:monospace;font-size:13px;border-top:1px solid #eaecef;">${outputs}</div>` : ''}</div>`;
        }).join('');
    };

    // 直接預覽 .ipynb 檔時才自動執行；被壓縮檔預覽載入時只提供上面的函式
    if (!window.PV || window.PV.category !== 'jupyter') return;
    const target = document.getElementById('render-content');
    fetch(window.TARGET_URL).then(r => r.text()).then(text => {
        target.innerHTML = window.renderJupyterNotebook(text);
        if (window.hljs) target.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }).catch(e => { target.innerHTML = `<div style="color:red;">解析失敗: ${escapeHTML(e.message)}</div>`; });
})();
