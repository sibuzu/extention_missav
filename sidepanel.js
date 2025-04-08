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

    await handleVideoDownload(list);
  }

  async function handleVideoDownload(list) {
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
