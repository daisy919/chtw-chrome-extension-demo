// 定義常量
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRI59_YaV4N0bBKBH7SJyJnQJMBHIY1-jCr0nkfZZEk1cPCfWek8_n0ZhQy0hbvsclesaHHMygiDiDB/pub?output=csv';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒數

// 從CSV解析詞彙對照表
async function parseCSV(csv) {
  const lines = csv.split('\n');
  const terms = {};
  
  for (let i = 1; i < lines.length; i++) { // 從第二行開始，跳過標題行
    const [cnTerm, twTerm, commonTerm, suggestedTerm] = lines[i].split(',').map(term => term.trim());
    
    // 處理中國用語和台灣用語（A欄和B欄）
    if (cnTerm && twTerm) {
      terms[cnTerm] = {
        replacement: twTerm,
        isCustom: false
      };
    }
    
    // 處理常見用法和建議用語（C欄和D欄）
    if (commonTerm && suggestedTerm) {
      terms[commonTerm] = {
        replacement: suggestedTerm,
        isCustom: true
      };
    }
  }
  
  return terms;
}

// 獲取並快取詞彙對照表
async function fetchAndCacheTerms() {
  try {
    const response = await fetch(SHEET_URL);
    const csv = await response.text();
    const terms = await parseCSV(csv);
    
    // 儲存詞彙對照表和快取時間
    await chrome.storage.local.set({
      terms: terms,
      lastUpdate: Date.now()
    });
    
    return terms;
  } catch (error) {
    console.error('Error fetching terms:', error);
    return null;
  }
}

// 檢查並更新快取
async function getTerms() {
  const data = await chrome.storage.local.get(['terms', 'lastUpdate']);
  const now = Date.now();
  
  // 如果沒有快取或快取已過期，重新獲取資料
  if (!data.terms || !data.lastUpdate || (now - data.lastUpdate > CACHE_DURATION)) {
    return await fetchAndCacheTerms();
  }
  
  return data.terms;
}

// 監聽來自 content script 的請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTerms') {
    getTerms().then(terms => {
      sendResponse({ terms: terms });
    });
    return true; // 將持續處理非同步回應
  }
});

// 安裝或更新擴充功能時初始化
chrome.runtime.onInstalled.addListener(() => {
  fetchAndCacheTerms();
});
