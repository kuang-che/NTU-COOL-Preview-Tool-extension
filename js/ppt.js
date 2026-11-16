// 簡報：PPTXjs 把每張投影片輸出成原始寬度的 .slide，再由 #warper 整體縮放到容器寬度。
// .slide 供 viewer.js 的頁碼、旋轉、縮放使用。EMF／TIFF 圖片在投影片出現後另外轉換。
(() => {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const container = $('container'), warper = $('warper'), result = $('result');
    const local = (file) => document.currentScript.src.replace('ppt.js', file);
    const scripts = { emf: local('EMFJS.bundle.min.js'), tiff: local('UTIF.js') };
    let slideW = 1280;

    const fitSlides = () => {
        const s = container.clientWidth / slideW;
        if (!s) return;
        warper.style.width = slideW + 'px';
        warper.style.transform = `scale(${s})`;
        // 投影片間距：縮放後固定為 10px，與原生頁面間距相同
        result.querySelectorAll('.slide').forEach(el => el.style.setProperty('margin-bottom', 10 / s + 'px', 'important'));
        container.style.height = warper.getBoundingClientRect().height + 'px';
    };

    const base64 = (img) => { const src = img.getAttribute('src'); return src.slice(src.indexOf(',') + 1); };
    const bytesOf = (img) => {
        const bin = atob(base64(img)), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    };

    // 從 EMF 取出內嵌的點陣圖（DIB），補上 BMP 檔頭後交給瀏覽器顯示。
    // 會帶點陣圖的紀錄：ALPHABLEND(114)、BITBLT(76)、STRETCHBLT(77)、STRETCHDIBITS(81)；值為 [offBmi, offBits] 欄位在紀錄內的位置
    const emfBitmapUrl = (bytes) => {
        const dv = new DataView(bytes.buffer), fields = { 114: [84, 92], 76: [84, 92], 77: [84, 92], 81: [48, 56] };
        for (let off = 0, size; off + 8 <= bytes.length; off += size) {
            const f = fields[dv.getUint32(off, true)];
            if ((size = dv.getUint32(off + 4, true)) < 8) break;
            if (!f || off + f[1] + 8 > bytes.length) continue;
            const [offBmi, cbBmi, offBits, cbBits] = [f[0], f[0] + 4, f[1], f[1] + 4].map(p => dv.getUint32(off + p, true));
            if (!cbBmi || !cbBits || offBmi + cbBmi > size || offBits + cbBits > size) continue;
            const head = new Uint8Array(14), hv = new DataView(head.buffer);
            head.set([0x42, 0x4D]);                         // 'BM'
            hv.setUint32(2, 14 + cbBmi + cbBits, true);     // 檔案大小
            hv.setUint32(10, 14 + cbBmi, true);             // 像素資料的起始位置
            return URL.createObjectURL(new Blob([head, bytes.subarray(off + offBmi, off + offBmi + cbBmi), bytes.subarray(off + offBits, off + offBits + cbBits)], { type: 'image/bmp' }));
        }
        return null;
    };

    // 瀏覽器不會顯示 EMF（Windows 向量圖）與 TIFF；有這類圖片時才載入轉換套件。轉換失敗就維持原狀。
    const converters = {
        // EMFJS 轉成 SVG；畫不出任何東西時（常見於整張 EMF 只包著一張點陣圖，例如貼上的截圖）改為直接取出那張圖
        emf(img) {
            const bytes = bytesOf(img), w = img.offsetWidth || img.parentNode.offsetWidth, h = img.offsetHeight || img.parentNode.offsetHeight;
            if (!w || !h) return;
            const svg = new EMFJS.Renderer(bytes.buffer).render({ width: w + 'px', height: h + 'px', wExt: w, hExt: h, xExt: w, yExt: h, mapMode: 8 });
            if (!svg || !svg.firstElementChild) { const url = emfBitmapUrl(bytes); if (url) img.src = url; return; }
            svg.style.cssText = `${img.style.cssText};width:${w}px;height:${h}px`;
            img.replaceWith(svg);
        },
        // UTIF.js 解碼後畫到 canvas，再換成 PNG
        tiff(img) {
            const { buffer } = bytesOf(img), ifd = UTIF.decode(buffer)[0];
            if (!ifd) return;
            UTIF.decodeImage(buffer, ifd);
            const canvas = Object.assign(document.createElement('canvas'), { width: ifd.width, height: ifd.height }), ctx = canvas.getContext('2d');
            const pixels = ctx.createImageData(ifd.width, ifd.height);
            pixels.data.set(UTIF.toRGBA8(ifd));
            ctx.putImageData(pixels, 0, 0);
            img.src = canvas.toDataURL('image/png');
        }
    };
    // PPTXjs 給 EMF 的 MIME 可能是 image/x-emf 或 image/emf；
    // TIFF 以內容開頭判斷（'II*\0' → SUkq、'MM\0*' → TU0AK），因為簡報裡 TIFF 的 MIME 可能只寫 image/*
    const kindOf = (img) => {
        const src = img.getAttribute('src');
        return /^data:image\/(x-)?emf/i.test(src) ? 'emf' : /^(SUkq|TU0AK)/.test(src.substr(src.indexOf(',') + 1, 5)) ? 'tiff' : null;
    };
    const convertImages = async () => {
        const jobs = [...result.querySelectorAll('img[src^="data:image/"]')].map(img => [kindOf(img), img]).filter(([kind]) => kind);
        if (!jobs.length) return;
        await window.pvLoad(...new Set(jobs.map(([kind]) => scripts[kind])));
        if (window.EMFJS) EMFJS.loggingEnabled(false);
        jobs.forEach(([kind, img]) => { try { converters[kind](img); } catch (e) { console.warn(kind + ' 轉換失敗：', e); } });
    };

    const fail = (msg) => {
        container.innerHTML = `<div class="pp-msg error">簡報載入失敗：${msg || '發生未知錯誤，請檢查檔案格式'}</div>`;
    };
    const done = () => {
        // PPTXjs 解析圖片填滿時會加上可列舉的 Object.prototype.set，只在解析期間用到；
        // 留著會讓 EMFJS 初始化失敗（Object.defineProperty 的描述物件繼承到 set），解析完就移除
        delete Object.prototype.set;
        // 水平／垂直的線條（例如箭頭接點）外框高或寬為 0，Chrome 不會繪製尺寸為 0 的 <svg>，即使設了 overflow:visible；
        // 補成 1px，線條座標不受影響，超出的部分照樣顯示
        result.querySelectorAll('svg.drawing').forEach(svg => {
            ['width', 'height'].forEach(prop => { if (!parseFloat(svg.style[prop])) svg.style[prop] = '1px'; });
        });
        const first = result.querySelector('.slide');
        slideW = (first && parseInt(first.style.width, 10)) || slideW;
        const loading = $('pp-loading');
        if (loading) loading.remove();
        fitSlides();
        window.addEventListener('resize', fitSlides);
        window.dispatchEvent(new Event('resize')); // 通知工具列更新頁數
        convertImages().catch(e => console.warn('圖片轉換套件載入失敗：', e)); // 投影片先顯示，圖片轉換隨後進行
    };

    try {
        if (typeof jQuery === 'undefined' || typeof jQuery.fn.pptxToHtml !== 'function') throw new Error('核心套件無法載入');
        jQuery(result).pptxToHtml({
            pptxFileUrl: window.TARGET_URL,
            slideMode: false,
            keyBoardShortCut: false,
            slideModeConfig: { first: 1, nav: false, showPlayPauseBtn: false, keyBoardShortCut: false, showSlideNum: false, showTotalSlideNum: false, autoSlide: false, randomAutoSlide: false, loop: false, background: 'black', transition: 'default', transitionTime: 1 }
        });
    } catch (e) {
        console.error('PPTX Parse Error:', e);
        fail(e.message);
        return;
    }

    // PPTXjs 沒有完成回呼：所有投影片是在同一輪內一次加進來的，所以一出現 .slide 就代表已全部完成。
    // 它的載入條（.slides-loadnig-msg，拼字照原套件）若消失卻沒有任何投影片，表示讀取失敗。
    // 解析途中拋出的錯誤發生在 PPTXjs 的非同步回呼裡，接不到，只能從 window 的 error 事件得知
    const started = Date.now();
    let crashed = null;
    const onError = (e) => { crashed = (e.error && e.error.message) || e.message; };
    window.addEventListener('error', onError);
    const timer = setInterval(() => {
        if (!result.querySelector('.slide') && !crashed && result.querySelector('.slides-loadnig-msg') && Date.now() - started < 120000) return;
        clearInterval(timer);
        window.removeEventListener('error', onError);
        if (result.querySelector('.slide')) done();
        else fail(crashed || (result.querySelector('.slides-loadnig-msg') ? '處理時間逾時' : '無法讀取檔案'));
    }, 200);
})();
