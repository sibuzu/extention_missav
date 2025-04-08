// 定義狀態和對應的選擇器
const STATE_SELECTORS = {
  'input-mode': 'button[data-testid="send-button"][disabled], button[data-testid="composer-speech-button"]',
  'ready-to-send': 'button[data-testid="send-button"]:not([disabled])',
  'running': 'button[data-testid="stop-button"]'
};

// 列出所有 data-testid
function logAllDataTestIds() {
  const elements = document.querySelectorAll('[data-testid]');
  console.log('[Contents] All data-testid elements found:');
  elements.forEach(element => {
    let attr = element.getAttribute('data-testid');
    console.log(`[Contents] - ${attr}`);
    if (attr === 'composer-speech-button') {
      console.log('[Contents] Found composer-speech-button element:', element);
      console.log('[Contents] Voice button HTML:', element.outerHTML);
    }
  });
}

// 檢查當前狀態
function checkState() {
  // console.log('[Contents] Checking state...');

  for (const [state, selector] of Object.entries(STATE_SELECTORS)) {
    if (document.querySelector(selector)) {
      // console.log('[Contents] Current state:', state);
      chrome.runtime.sendMessage({
        type: 'stateChange',
        state: state
      });
      return;
    }
  }

  // 如果都沒找到，則為 not-found
  console.log('[Contents] Current state: not-found');
  logAllDataTestIds();
  chrome.runtime.sendMessage({
    type: 'stateChange',
    state: 'not-found'
  });
}

// 設置 MutationObserver
const observer = new MutationObserver((mutations) => {
  // console.log('[Contents] DOM mutation detected');
  checkState();
});

// 開始觀察
function startObserving() {
  console.log('[Contents] Starting observation...');
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'disabled']
  });

  // 初始檢查
  checkState();
}

// 當 DOM 載入完成後開始觀察
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
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

// 監聽來自 sidepanel 的消息
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'queryImageList') {
    console.log('[Contents] Querying image list...');
    const imageList = [];
    
    // 查找所有對話回合
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    
    turns.forEach(turn => {
      // 獲取 turnId
      console.log('[Contents] Turn:', turn);
      const turnId = turn.getAttribute('data-testid').replace('conversation-turn-', '');
      
      // 查找圖片容器
      const imageContainer = turn.querySelector('.group\\/imagegen-image');
      if (imageContainer) {
        // 查找第一個圖片元素
        const img = imageContainer.querySelector('img');
        if (img) {
          imageList.push({
            turnId: turnId,
            src: img.src
          });
        }
      }
    });
    
    // 發送結果回 sidepanel
    chrome.runtime.sendMessage({
      type: 'imageList',
      list: imageList
    });
  } else if (request.action === 'sendMsg') {
    console.log('[Contents] Sending GPT message:', request.text);
    
    // 找到 ChatGPT 的輸入框
    const promptTextarea = document.querySelector('[id="prompt-textarea"]');
    
    if (promptTextarea) {
      try {
        // 解析 markdown 格式的圖片
        const imageMatches = request.text.match(/!\[.*?\]\((.*?)\)\n/g);
        const textContent = request.text.replace(/!\[.*?\]\((.*?)\)\n/g, '');
        
        // 如果有圖片，先處理圖片
        if (imageMatches) {
          // 一次只處理一組圖片
          for (const imgMarkdown of imageMatches) {
            const imgUrl = imgMarkdown.match(/\((.*?)\)/)[1];
            
            console.log('[Contents] Processing image:', imgUrl.substring(0, 50) + '...');
            
            // 將 base64 圖片轉換為 blob
            const response = await fetch(imgUrl);
            const blob = await response.blob();
            
            // 確保頁面和輸入框有焦點
            window.focus();
            promptTextarea.focus();
            
            // 等待焦點設置完成
            await new Promise(resolve => setTimeout(resolve, 100));

            // 嘗試插入圖片
            await insertImage(promptTextarea, blob);
            
            // 等待圖片插入完成
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // 處理文本內容
        if (textContent.trim()) {
          promptTextarea.focus();
          document.execCommand('insertText', false, textContent.trim());
        }
        
        // 觸發 input 事件以激活發送按鈕
        promptTextarea.dispatchEvent(new Event('input', { 
          bubbles: true,
          cancelable: true 
        }));
        
        // 等待發送按鈕變為可用並點擊
        await waitForAndClickSendButton(imageMatches ? 40 : 10);
        
        // 等待回應完成
        await waitForResponse();
        
      } catch (error) {
        console.error('[Contents] Error processing message:', error);
      }
    }
  }
});

// 添加必要的輔助函數
function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
}

async function insertImage(textarea, blob) {
  try {
    // 使用 input event 直接插入檔案
    const file = new File([blob], 'image.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste',
      data: null,
      dataTransfer: dt
    });
    
    textarea.dispatchEvent(inputEvent);
    
    // 如果上面的方法失敗，嘗試使用 drop 事件
    if (!textarea.querySelector('img')) {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });
      textarea.dispatchEvent(dropEvent);
    }
  } catch (error) {
    console.error('[Contents] Image insertion failed:', error);
    // 備用方案：使用 FormData
    const formData = new FormData();
    formData.append('image', blob, 'image.png');
    textarea.dispatchEvent(new CustomEvent('imageUpload', {
      detail: { formData: formData }
    }));
  }
}

async function waitForAndClickSendButton(maxAttempts) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkButton = () => {
      const sendButton = document.querySelector('button[data-testid="send-button"]:not([disabled])');
      if (sendButton) {
        console.log('[Contents] Send button is ready');
        sendButton.click();
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error(`Timeout waiting for send button after ${maxAttempts * 2000}ms`));
      } else {
        console.log('[Contents] Waiting for send button... attempt:', attempts + 1, 
                   `(${attempts * 2000}ms / ${maxAttempts * 2000}ms)`);
        attempts++;
        setTimeout(checkButton, 2000);
      }
    };
    checkButton();
  });
}

async function waitForResponse() {
  return new Promise((resolve) => {
    const checkResponse = () => {
      // 檢查是否有正在生成的回應
      const responseInProgress = document.querySelector('.result-streaming');
      if (!responseInProgress) {
        console.log('[Contents] Response completed');
        resolve();
      } else {
        console.log('[Contents] Waiting for response to complete...');
        setTimeout(checkResponse, 1000);
      }
    };
    setTimeout(checkResponse, 1000); // 給一些時間讓回應開始生成
  });
}
