const API_URL = 'http://solarsuna.com:32345';

document.addEventListener('DOMContentLoaded', function () {
  // Initialize SVG icons
  const template = document.getElementById('toggle-icon-template');
  document.querySelectorAll('.toggle-icon-container').forEach(container => {
    const clone = template.content.cloneNode(true);
    const svg = clone.querySelector('svg');
    const vLine = clone.querySelector('#v-line');

    if (container.dataset.state === 'open') {
      vLine.style.display = 'none';
    }

    container.appendChild(clone);
  });

  // 初始化可折疊面板
  const headers = document.querySelectorAll('.panel-header');
  headers.forEach(header => {
    header.addEventListener('click', function () {
      const content = this.nextElementSibling;
      const icon = this.querySelector('.toggle-icon');
      const verticalLine = icon.querySelector('#v-line');
      const isOpen = content.style.display === 'block';

      content.style.display = isOpen ? 'none' : 'block';

      if (isOpen) {
        verticalLine.style.display = 'block';
        icon.setAttribute('data-state', 'closed');
      } else {
        verticalLine.style.display = 'none';
        icon.setAttribute('data-state', 'open');
      }
    });
  });

  // 更新頁面信息的函數
  function updatePageInfo(info) {
    document.getElementById('title').textContent = `Title: ${info.title}`;
    document.getElementById('url').textContent = `URL: ${info.url}`;
    document.getElementById('image').textContent = `Image: ${info.image}`;
    document.getElementById('description').textContent = `Description: ${info.description}`;
  }

  // 請求當前頁面信息
  async function requestPageInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'getPageInfo' });
      }
    } catch (error) {
      console.error('[Sidepanel] Error requesting page info:', error);
    }
  }

  // 監聽來自 content script 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Sidepanel] Received message:', request);

    if (request.type === 'pageInfo') {
      updatePageInfo(request.data);
    }
  });

  // 初始化時請求頁面信息
  requestPageInfo();

  // 獲取必要的 DOM 元素
  const downloadVideoButton = document.getElementById('downloadVideo');
  const downloadStatusElement = document.getElementById('downloadStatus');
  const sourceElement = document.getElementById('source');

  // Download Video button click handler
  downloadVideoButton.addEventListener('click', async function () {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        downloadStatusElement.textContent = 'Status: checking source...';
        sourceElement.textContent = 'Source: searching...';
        
        // 發送請求到 content script
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'getVideoSource'
        });
      }
    } catch (error) {
      console.error('[Sidepanel] Error in download handler:', error);
      downloadStatusElement.textContent = 'Status: Error occurred';
      sourceElement.textContent = 'Source: error';
    }
  });

  // 監聽來自 content script 的消息
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log('[Sidepanel] Received message:', request);

    if (request.type === 'pageInfo') {
      updatePageInfo(request.data);
    } else if (request.type === 'videoSource') {
      let info = request.data;
      if (info && info.source) {
        downloadStatusElement.textContent = 'Status: source found';
        sourceElement.textContent = `Source: ${info.source}`;
        await handleVideoDownload(info);
      } else {
        downloadStatusElement.textContent = 'Status: no source found';
        sourceElement.textContent = 'Source: not available';
      }
    }
  });

  async function handleVideoDownload(info) {
    try {
      console.log('[Sidepanel] handleVideoDownload', info);
      downloadStatusElement.textContent = 'Status: call API ...';
      const response = await fetch(`${API_URL}/missav/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info)
      });
      downloadStatusElement.textContent = `Status: ${await response.text()}`;
    } catch (error) {
      downloadStatusElement.textContent = `Status: [API error] ${error.message}`;
    }
  }
});
