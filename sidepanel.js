const API_URL = 'http://solarsuna.com:32345';
let startTime = null;
let isPaused = false;
let promptQueue = [];
let isProcessingQueue = false;

// 狀態相關變數
let currentState = null;     // 當前狀態
let canSend = true;         // 控制是否可以發送訊息

// 更新 promptList 顯示
function updatePromptList() {
  const promptListElement = document.getElementById('promptList');
  promptListElement.innerHTML = '';

  promptQueue.forEach((prompt, index) => {
    const div = document.createElement('div');
    div.className = 'prompt-item';

    // 移除所有圖片的 markdown 格式 (![...](...)格式)
    const textOnly = prompt.replace(/!\[.*?\]\(.*?\)\n/g, '');
    // 計算圖片數量
    const imageCount = (prompt.match(/!\[.*?\]\(.*?\)\n/g) || []).length;
    let displayText = textOnly;

    if (imageCount > 0) {
      // 若有圖片，顯示 [n] 前綴加上最多18個字
      displayText = displayText.length > 18 ? displayText.substring(0, 18) + '...' : displayText;
      displayText = `[${imageCount}] ${displayText}`;
    } else {
      // 若無圖片，顯示最多20個字
      displayText = displayText.length > 20 ? displayText.substring(0, 20) + '...' : displayText;
    }

    div.textContent = `${index + 1}. ${displayText}`;
    promptListElement.appendChild(div);
  });
}

async function sendTelegram(msg) {
  // Escape HTML and Telegram special characters
  const escapedMsg = msg
    .replace(/[<>&]/g, char => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;'
    })[char]);

  try {
    const result = await chrome.storage.local.get(['notifyTelegram']);
    if (result.notifyTelegram) {
      const response = await fetch(`${API_URL}/notify/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: escapedMsg })
      });
      console.log('[Sidepanel] Telegram notification sent:', await response.text());
    }
  } catch (error) {
    console.error('[Sidepanel] Failed to send Telegram notification:', error);
  }
}

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

  // 元素獲取
  const downloadVideoButton = document.getElementById('downloadVideo');
  const downloadStatusElement = document.getElementById('downloadStatus');
  
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

  // Download Images button click handler
  downloadVideoButton.addEventListener('click', async function () {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        console.log('[Sidepanel] Current URL:', currentUrl);

        let pageId = '';
        // 先移除 URL 中 ? 後面的所有內容
        const baseUrl = currentUrl.split('?')[0];
        
        if (baseUrl.match(/-[0-9a-f]{12}$/)) {
          pageId = baseUrl.slice(-12);
        }

        const pageIdElement = document.getElementById('pageId');
        pageIdElement.textContent = `PageID: ${pageId}`;

        if (pageId) {
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'queryImageList'
          });
        } else {
          downloadStatusElement.textContent = 'Status: no image';
          document.getElementById('imgList').innerHTML = '';
          document.getElementById('totalTurns').textContent = 'Total Turns: 0';
        }
      }
    } catch (error) {
      console.error('[Sidepanel] Error in download handler:', error);
      downloadStatusElement.textContent = 'Status: Error occurred';
    }
  });

  // Message listeners
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log('[Sidepanel] Received message:', request);

    switch (request.type) {
      case 'selectedText':
        messageInput.value = request.text;
        break;
      case 'closePanel':
        window.close();
        break;
      case 'stateChange':
        const stateElement = document.getElementById('state');
        currentState = request.state;
        stateElement.textContent = `State: ${currentState}`;

        if (currentState != 'input-mode') {
          // 當前不是 input-mode，表示已經開始執行，可以準備發送下一個(當再次變成 input-mode 時)
          canSend = true;
        }

        if (currentState === 'running') {
          startTimer();
        } else if (currentState === 'input-mode') {
          if (startTime) {
            stopTimer();
            if (promptQueue.length === 0) {
              await sendTelegram('ChatGPT is ready.');
            }
          }
          await processPromptQueue();
        }
        break;
      case 'imageList':
        await handleImageList(request.list);
        break;
    }
  });

  async function handleImageList(list) {
    const imgListElement = document.getElementById('imgList');
    const totalTurnsElement = document.getElementById('totalTurns');

    if (list.length === 0) {
      downloadStatusElement.textContent = 'Status: no image';
      imgListElement.innerHTML = '';
      totalTurnsElement.textContent = 'Total Turns: 0';
      return;
    }

    totalTurnsElement.textContent = `Total Turns: ${list.length}`;
    imgListElement.innerHTML = '';

    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'mb-2';
      div.textContent = `Turn ${item.turnId}: ${item.src.substring(56, 83)}`;
      imgListElement.appendChild(div);
    });

    await handleImageDownload(list);
  }

  async function handleImageDownload(list) {
    try {
      downloadStatusElement.textContent = 'Status: call API ...';
      const response = await fetch(`${API_URL}/images/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: document.getElementById('pageId').textContent.replace('PageID: ', ''),
          turns: list.map(item => ({
            id: item.turnId,
            url: item.src
          }))
        })
      });
      downloadStatusElement.textContent = `Status: ${await response.text()}`;
    } catch (error) {
      downloadStatusElement.textContent = `Status: API error: ${error.message}`;
    }
  }

  // 防止直接在 messageInput 根元素上編輯
  messageInput.addEventListener('click', (e) => {
    if (e.target === messageInput) {
      messageInput.querySelector('.text-container').focus();
    }
  });
});
