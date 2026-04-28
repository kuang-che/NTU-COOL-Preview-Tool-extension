document.addEventListener('DOMContentLoaded', () => {
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

    const fields = Object.keys(defaultSettings);

    chrome.storage.sync.get(defaultSettings, (items) => {
        fields.forEach(field => {
            document.getElementById(field).value = items[field];
        });
    });

    document.getElementById('save').addEventListener('click', () => {
        const newSettings = {};
        fields.forEach(field => {
            newSettings[field] = document.getElementById(field).value;
        });

        chrome.storage.sync.set(newSettings, () => {
            const status = document.getElementById('status');
            status.textContent = '設定已成功儲存，重新整理網頁後生效';
            setTimeout(() => { status.textContent = ''; }, 3000);
        });
    });
});
