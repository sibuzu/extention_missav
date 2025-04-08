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

// 處理佇列中的提示
const pauseQueueCheckbox = document.getElementById('pauseQueue');

// 監聽 pause checkbox 變化
pauseQueueCheckbox.addEventListener('change', function (e) {
  isPaused = e.target.checked;
  console.log('[Sidepanel] Queue paused:', isPaused);

  // 如果取消暫停，嘗試處理佇列
  if (!isPaused) {
    canSend = true;
    processPromptQueue();
  }
});

async function processPromptQueue() {
  console.log('[Sidepanel] processPromptQueue -Current state:', currentState);
  // send telegram
  // await sendTelegram("processPromptQueue");
  if (isProcessingQueue || promptQueue.length === 0 || isPaused || !canSend) return;

  if (currentState !== 'input-mode') {
    return;
  }

  // 設 canSend=false，避免連續觸發，只有state changed後，canSend才會被重設為true。
  canSend = false;

  isProcessingQueue = true;
  try {
    const text = promptQueue[0];
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'sendMsg',
        text: text
      });

      // send telegram
      // Remove markdown image format (![...](...)格式) and send text only
      const textOnly = text.replace(/!\[.*?\]\(.*?\)\n/g, '');
      await sendTelegram("send " + textOnly);

      // 先移除已處理的提示並更新顯示
      promptQueue.shift();
      updatePromptList();
      console.log('[Sidepanel] Processed prompt from queue, remaining:', promptQueue.length);

      // 然後等待 1~5 秒, rate = 25%
      await DelayRandTime(1, 5, 0.25);

      // 注意：不在這裡繼續處理下一個提示
      // 等待 state 變化事件處理程序來觸發下一個提示的處理
    }
  } catch (error) {
    console.error('[Sidepanel] Error processing prompt queue:', error);
  } finally {
    isProcessingQueue = false;
  }
}

async function DelayRandTime(minSec, maxSec, passRate) {
  if (passRate <= 0 || passRate > 1) {
    throw new Error('passRate must be between 0 and 1');
  }

  while (true) {
    // 產生 [minSec, maxSec] 範圍內的隨機秒數
    const delayTime = minSec + Math.random() * (maxSec - minSec);

    // 等待指定的時間
    await new Promise(resolve => setTimeout(resolve, delayTime * 1000));


    // 產生 (0,1) 範圍內的隨機數
    const k = Math.random();

    console.log('[DelayRandTime] delayTime:', delayTime, 'k:', k, 'passRate:', passRate);

    // 如果隨機數小於通過率，則結束等待
    if (k < passRate) {
      return;
    }
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
  const downloadImagesButton = document.getElementById('downloadImages');
  const downloadStatusElement = document.getElementById('downloadStatus');
  const messageInput = document.getElementById('messageInput');
  const chatContainer = document.getElementById('chatContainer');
  const elapsedTimeElement = document.getElementById('elapsedTime');
  const notifyTelegramCheckbox = document.getElementById('notifyTelegram');
  const sendMsgButton = document.getElementById('sendMsg');
  const clearQueueButton = document.getElementById('clearQueue');

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

  // Timer functions
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  function startTimer() {
    if (!startTime) {
      startTime = Date.now();
    }
    const endTime = Date.now();
    const elapsed = (endTime - startTime) / 1000;
    elapsedTimeElement.textContent = `Elapsed: ${elapsed.toFixed(2)}s (${formatTimestamp(startTime)})`;
  }

  function stopTimer() {
    if (startTime) {
      const endTime = Date.now();
      const elapsed = (endTime - startTime) / 1000;
      elapsedTimeElement.textContent = `Elapsed: ${elapsed.toFixed(2)}s (${formatTimestamp(startTime)})`;
      startTime = null;
    }
  }

  // 初始化時從 storage 讀取 checkbox 狀態
  chrome.storage.local.get(['notifyTelegram']).then(result => {
    notifyTelegramCheckbox.checked = result.notifyTelegram || false;
  }).catch(error => {
    console.error('[Sidepanel] Error reading storage:', error);
  });

  // 監聽 checkbox 變化並保存狀態
  notifyTelegramCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ notifyTelegram: this.checked }).catch(error => {
      console.error('[Sidepanel] Error saving to storage:', error);
    });
  });

  // Download Images button click handler
  downloadImagesButton.addEventListener('click', async function () {
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

  // Message handling functions
  function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'gpt-message'}`;
    messageDiv.textContent = content;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // 初始化輸入框結構
  function initializeMessageInput() {
    // 清空現有內容
    messageInput.innerHTML = '';

    // 創建圖片容器
    const imagesContainer = document.createElement('div');
    imagesContainer.className = 'images-container';

    // 創建文字容器
    const textContainer = document.createElement('div');
    textContainer.className = 'text-container';
    textContainer.contentEditable = true;

    messageInput.appendChild(imagesContainer);
    messageInput.appendChild(textContainer);

    // 將焦點設置到文字容器
    textContainer.focus();
  }

  // 初始化輸入框
  initializeMessageInput();

  // 處理貼上事件
  messageInput.addEventListener('paste', async (e) => {
    e.preventDefault();

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const imagesContainer = messageInput.querySelector('.images-container');
    const textContainer = messageInput.querySelector('.text-container');

    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        const blob = item.getAsFile();
        const reader = new FileReader();

        reader.onload = function (event) {
          const img = document.createElement('img');
          img.src = event.target.result;
          imagesContainer.appendChild(img);
        };

        reader.readAsDataURL(blob);
      } else if (item.type === 'text/plain') {
        // 處理純文本
        const text = await new Promise(resolve => item.getAsString(resolve));
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);

        // console.log('[Sidepanel] text:', text);
        
        // 確保文本插入到 textContainer 中
        if (!textContainer.contains(range.commonAncestorContainer)) {
          textContainer.focus();
          selection.removeAllRanges();
          range.selectNodeContents(textContainer);
          range.collapse(false);
          selection.addRange(range);
        }

        const text2 = text.replace(/\n/g, '\r').trim();
        console.log('[Sidepanel] text2:', text2);
        document.execCommand('insertText', false, text2);
      }
    }
  });

  // Send button handler
  sendMsgButton.addEventListener('click', async function () {
    const textContainer = messageInput.querySelector('.text-container');
    const imagesContainer = messageInput.querySelector('.images-container');
    // 使用 innerText 而不是 textContent 來保留換行，但不包含隱藏元素
    const messageText = textContainer.innerText.trim();
    const images = Array.from(imagesContainer.querySelectorAll('img'));  // 轉換為陣列以保持順序

    // console.log('[Sidepanel] messageInput:', messageInput);
    // console.log('[Sidepanel] textContainer:', textContainer);
    // console.log('[Sidepanel] imagesContainer:', imagesContainer);
    // console.log('[Sidepanel] textContainer.innerText:', textContainer.innerText);
    // console.log('[Sidepanel] Message:', messageText);
    
    if (!messageText && images.length === 0) return;

    let message = messageText;

    // 如果有圖片，將其轉換為 Markdown 格式（反轉陣列以保持原始貼上順序）
    if (images.length > 0) {
      images.reverse().forEach((img, index) => {
        message = `![Image ${images.length - index}](${img.src})\n` + message;
      });
    }

    promptQueue.push(message);
    updatePromptList();

    // 重新初始化輸入框
    initializeMessageInput();

    if (currentState === 'input-mode') {
      processPromptQueue();
    }
  });

  // Clear button handler
  clearQueueButton.addEventListener('click', function () {
    promptQueue = [];  // 清空佇列
    updatePromptList(); // 更新顯示
    console.log('[Sidepanel] Queue cleared');
  });

  // Upload button handler
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');

  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    const imagesContainer = messageInput.querySelector('.images-container');

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();

        reader.onload = (event) => {
          const img = document.createElement('img');
          img.src = event.target.result;
          imagesContainer.appendChild(img);
        };

        reader.readAsDataURL(file);
      }
    }

    // 清空 file input 的值，這樣相同的檔案可以再次上傳
    fileInput.value = '';
  });

  // Script button handler
  const scriptBtn = document.getElementById('scriptBtn');
  const scriptInput = document.getElementById('scriptInput');

  scriptBtn.addEventListener('click', () => {
    scriptInput.click();
  });

  scriptInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const scriptData = JSON.parse(text);

      // 檢查是否為新格式（至少要有 prompt 陣列）
      if (!scriptData.prompt || !Array.isArray(scriptData.prompt)) {
        console.error('[Sidepanel] Invalid script format: missing prompt array');
        return;
      }

      // 處理每個 prompt
      for (const item of scriptData.prompt) {
        let message = item.prompt;

        // 如果有圖片檔案且 scriptData.images 存在，處理圖片
        if (item.files && item.files.length > 0 && scriptData.images) {
          // 從最後一張開始加入，這樣在最終顯示時會保持原始順序
          for (let i = item.files.length - 1; i >= 0; i--) {
            const filePath = item.files[i];
            const base64Image = scriptData.images[filePath];
            if (base64Image) {
              message = `![Image ${i + 1}](${base64Image})\n` + message;
            }
          }
        }

        // 加入到 prompt queue
        promptQueue.push(message);
      }

      // 更新顯示
      updatePromptList();

      // 如果當前是 input-mode，開始處理佇列
      if (currentState === 'input-mode') {
        processPromptQueue();
      }

      console.log('[Sidepanel] Script loaded, prompts added:', scriptData.prompt.length);
    } catch (error) {
      console.error('[Sidepanel] Error processing script file:', error);
    }

    // 清空 input 值以支援重複載入相同檔案
    scriptInput.value = '';
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
