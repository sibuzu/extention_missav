
console.log('[Content] Script loaded');

function checkVideoSources() {
    console.log('[Content] Checking video sources');
    try {
        // 收集頁面信息
        const pageInfo = {
            title: document.querySelector('title')?.textContent || '',
            url: document.querySelector('meta[property="og:url"]')?.content || window.location.href,
            image: document.querySelector('meta[property="og:image"]')?.content || '',
            description: document.querySelector('meta[property="og:description"]')?.content || ''
        };

        console.log('[Content] Page info:', pageInfo);

        // 發送到 sidepanel
        chrome.runtime.sendMessage({
            type: 'pageInfo',
            data: pageInfo
        });

    } catch (error) {
        console.error('[Content] Error in checkVideoSources:', error);
    }
}

// 監聽來自 sidepanel 的請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Content] Message received:', request);
    
    if (request.type === 'getPageInfo') {
        // 立即檢查並發送頁面信息
        checkVideoSources();
        sendResponse({ status: 'checking' });
    }
});

// 初始化時執行檢查
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkVideoSources();
} else {
    document.addEventListener('DOMContentLoaded', checkVideoSources);
}
