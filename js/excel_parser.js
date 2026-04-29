const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

async function parseExcelFile() {
    const absoluteUrl = window.TARGET_URL || document.body.getAttribute('data-url');
    if (!absoluteUrl) return;
    window.TARGET_URL = absoluteUrl;
    
    try {
        const w = XLSX.read(await (await fetch(absoluteUrl)).arrayBuffer(), { type: 'array' });
        let h = '<div style="padding:15px;font-family:sans-serif;">';
        w.SheetNames.forEach(n => {
            h += `<h3 style="color:#0099CC;margin-top:20px;">${escapeHTML(n)}</h3>` + XLSX.utils.sheet_to_html(w.Sheets[n]);
        });
        const renderContent = document.getElementById('render-content');
        renderContent.innerHTML = h + '</div>';
        
        renderContent.querySelectorAll('table').forEach(t => {
            t.style.borderCollapse = 'collapse';
            t.style.width = '100%';
            t.querySelectorAll('th,td').forEach(c => {
                c.style.border = '1px solid #ddd';
                c.style.padding = '8px';
                c.style.fontSize = '13px';
            });
            t.querySelectorAll('th').forEach(c => c.style.backgroundColor = '#f2f2f2');
        });
    } catch (e) {
        document.getElementById('render-content').innerHTML = `<div style="color:red;">解析失敗: ${escapeHTML(e.message)}</div>`;
    }
}

parseExcelFile();
