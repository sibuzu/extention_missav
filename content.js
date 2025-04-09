
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

// 解密函數的直接實現
const decrypt = (p, a, c, k, e, d) => {
  e = function (c) { return c.toString(36) };
  if (!''.replace(/^/, String)) {
    while (c--) {
      d[c.toString(a)] = k[c] || c.toString(a)
    }
    k = [function (e) { return d[e] }];
    e = function () { return '\\w+' };
    c = 1
  };
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c])
    }
  }
  return p
};

// 監聽來自 sidepanel 的請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Message received:', request);

  if (request.type === 'getPageInfo') {
    checkVideoSources();
    sendResponse({ status: 'checking' });
  } else if (request.type === 'getVideoSource') {
    try {
      // 直接使用解密函數
      const result = decrypt(
        'f=\'8://7.6/5-4-3-2-1/e.0\';d=\'8://7.6/5-4-3-2-1/c/9.0\';b=\'8://7.6/5-4-3-2-1/a/9.0\';',
        16,
        16,
        'm3u8|458deb87594e|b8d5|4922|89bb|4dbfa06c|com|surrit|https|video|1280x720|source1280|842x480|source842|playlist|source'.split('|'),
        0,
        {}
      );

      console.log('[Content] Decrypted result:', result);

      // 解析結果中的 source1280 URL
      const match = result.match(/source1280='([^']+)'/);
      if (match) {
        const videoSource = match[1];
        console.log('[Content] Found video source:', videoSource);
        chrome.runtime.sendMessage({
          type: 'videoSource',
          data: videoSource
        });
      } else {
        // 嘗試直接從結果中提取 URL
        const urlMatch = result.match(/https:\/\/[^']+1280x720\/video\.m3u8/);
        if (urlMatch) {
          const videoSource = urlMatch[0];
          console.log('[Content] Found video source from URL:', videoSource);
          chrome.runtime.sendMessage({
            type: 'videoSource',
            data: videoSource
          });
        } else {
          console.log('[Content] No video source found in result');
          chrome.runtime.sendMessage({
            type: 'videoSource',
            data: ''
          });
        }
      }
    } catch (error) {
      console.error('[Content] Error in decrypt:', error);
      chrome.runtime.sendMessage({
        type: 'videoSource',
        data: ''
      });
    }

    sendResponse({ status: 'checking' });
  }
});

// 初始化時執行檢查
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  checkVideoSources();
} else {
  document.addEventListener('DOMContentLoaded', checkVideoSources);
}
