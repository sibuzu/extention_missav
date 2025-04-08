
console.log('[Content] Script loaded');

function checkVideoSources() {
    console.log('[Content] Checking video sources');
    try {
        // 嘗試獲取視頻源
        console.log('[Content] source1280:', window.source1280);
        
        // find 
        // <meta property="og:image" content="https://fourhoi.com/jul-530-uncensored-leak/cover-n.jpg">
        const metaElement = document.querySelector('meta[property="og:image"]');
        if (metaElement) {
            console.log('[Content] og:image content:', metaElement.content);
        }

        // <meta property="og:url" content="https://missav.ai/dm39/ja/jul-530-uncensored-leak">
        const ogUrlElement = document.querySelector('meta[property="og:url"]');
        if (ogUrlElement) {
            console.log('[Content] og:url content:', ogUrlElement.content);
        } 

        // <title>...</title>
        const titleElement = document.querySelector('title');
        if (titleElement) {
            console.log('[Content] title content:', titleElement.textContent);
        } 

        // <meta property="og:description">
        const ogDescriptionElement = document.querySelector('meta[property="og:description"]');
        if (ogDescriptionElement) {
            console.log('[Content] og:description content:', ogDescriptionElement.content);
        }
    } catch (error) {
        console.error('[Content] Error in checkVideoSources:', error);
    }
}

function init() {
    console.log('[Content] Init function called');
    checkVideoSources();
}

// 立即執行初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[Content] Document already ready, initializing...');
    init();
} else {
    console.log('[Content] Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init);
}

// 保持消息監聽器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Content] Message received:', request);
    if (request.type === 'ping') {
        console.log('[Content] Ping received, sending response');
        sendResponse({ status: 'ok' });
    }
});
