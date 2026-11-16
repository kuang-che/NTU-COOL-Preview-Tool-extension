// 預設可預覽的副檔名，content.js（COOL 頁面上）與 popup.js（設定視窗）共用這一份。
// 簡報預設只有 .pptx：PPTXjs 讀不了舊版的 .ppt（二進位格式），預設交給 COOL 原生預覽；使用者仍可自行加入
const DEFAULT_SETTINGS = {
    images: 'png, jpg, jpeg, gif, svg, webp',
    videos: 'mp4, webm, ogg, mov',
    audios: 'mp3, wav, ogg, m4a',
    codes: 'py, v, sv, c, cpp, js, html, css, json, md, sh, java, m',
    plaintext: 'txt, log, csv',
    archives: 'zip, tgz, gz',
    excels: 'xls, xlsx',
    powerpoints: 'pptx',
    jupyter: 'ipynb'
};
