document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    window.TARGET_URL = body.getAttribute('data-url');
    window.TARGET_EXT = body.getAttribute('data-ext');
    const category = body.getAttribute('data-category');
    const i18nCopied = body.getAttribute('data-i18n-copied') || 'Copied';

    // Highlight JS
    if (window.hljs && category === 'code') {
        window.hljs.highlightAll();
    }

    // PPTX Initialization
    if (category === 'powerpoint' && typeof $ !== 'undefined') {
        $(function(){
            var $container = $('#container');
            var $result = $('#result');
            function showError(msg) {
                $container.html('<div class="error-msg">簡報載入失敗：' + (msg || '發生未知錯誤，請檢查檔案格式') + '</div>');
            }
            try {
                if (typeof $result.pptxToHtml !== 'function') throw new Error('核心套件無法載入');
                $result.pptxToHtml({
                    pptxFileUrl: window.TARGET_URL,
                    slideMode: false,
                    keyBoardShortCut: false,
                    slideModeConfig: {first:1, nav:false, showPlayPauseBtn:false, keyBoardShortCut:false, showSlideNum:false, showTotalSlideNum:false, autoSlide:false, randomAutoSlide:false, loop:false, background:"black", transition:"default", transitionTime:1}
                });
                function fitSlides(){
                    var slideDom = $('.slide').first()[0];
                    var realW = (slideDom && parseInt(slideDom.style.width,10)) || 1280;
                    $('#warper').css('width', realW + 'px');
                    var c = $container.width(), s = Math.min(1, c/(realW+2));
                    $('#warper').css({'transform': 'scale('+s+')', 'transform-origin': 'top left'});
                    var h = $('#warper')[0].getBoundingClientRect().height;
                    if (h > 0) $container.css('height', (h+15) + 'px');
                }
                $(window).on('resize', fitSlides);
                var attempts = 0, maxAttempts = 40; 
                var l = setInterval(function(){
                    if($('.slide').length > 0){
                        fitSlides();
                        clearInterval(l);
                    } else {
                        attempts++;
                        if(attempts >= maxAttempts){
                            clearInterval(l);
                            showError('處理時間逾時');
                        }
                    }
                }, 250);
            } catch(e) {
                console.error('PPTX Parse Error:', e);
                showError(e.message);
            }
        });
    }

    // Toolbar Buttons
    const cb = document.getElementById('fs-copy-btn');
    if (cb) {
        const ot = cb.querySelector('span').innerText;
        cb.onclick = async () => {
            try {
                cb.querySelector('span').innerText = '...';
                await navigator.clipboard.writeText(await (await fetch(window.TARGET_URL)).text());
                cb.querySelector('span').innerText = i18nCopied;
                setTimeout(() => cb.querySelector('span').innerText = ot, 2000);
            } catch (e) {}
        };
    }

    const db = document.getElementById('download');
    if (db) {
        db.onclick = () => {
            let u = window.TARGET_URL;
            u += u.includes('?') ? '&download_frd=1' : '?download_frd=1';
            const a = document.createElement('a');
            a.href = u;
            a.target = '_blank';
            a.click();
        };
    }

    let sc = 1;
    const zc = document.getElementById('zoom-content');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');

    if (zoomInBtn && zc) {
        zoomInBtn.onclick = () => { sc += 0.15; zc.style.transform = `scale(${sc})`; };
    }
    if (zoomOutBtn && zc) {
        zoomOutBtn.onclick = () => { sc = Math.max(0.2, sc - 0.15); zc.style.transform = `scale(${sc})`; };
    }
});
