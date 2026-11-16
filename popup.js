document.addEventListener('DOMContentLoaded', () => {
    // DEFAULT_SETTINGS 定義在 defaults.js（與 content.js 共用），popup.html 會先載入它
    const fields = Object.keys(DEFAULT_SETTINGS);

    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
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
    document.getElementById('open-github').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/kuang-che/NTU-COOL-Preview-Tool-extension' });
});
});
