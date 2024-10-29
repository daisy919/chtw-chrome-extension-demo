// 儲存所有要轉換的詞彙
let termsMap = null;
let isEnabled = true;

// 建立tooltip元素
const tooltip = document.createElement('div');
tooltip.className = 'term-tooltip';
tooltip.style.display = 'none';
document.body.appendChild(tooltip);

// 檢查元素是否應該被忽略
function shouldIgnoreElement(element) {
  if (!element) return true;
  
  // 忽略這些標籤
  const ignoredTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'];
  if (ignoredTags.includes(element.tagName)) return true;
  
  // 忽略已經處理過的元素
  if (element.classList && (
    element.classList.contains('cn-term-highlight') || 
    element.classList.contains('custom-term-highlight')
  )) return true;
  
  return false;
}

// 處理動態內容的 MutationObserver
const observer = new MutationObserver((mutations) => {
  if (!isEnabled || !termsMap) return;
  
  const processedNodes = new Set();
  
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1 && !processedNodes.has(node)) {  // Element node
        processedNodes.add(node);
        setTimeout(() => highlightTerms(termsMap, node), 100);
      }
    });
  });
});

// 高亮顯示用語
function highlightTerms(terms, rootNode = document.body) {
  if (!isEnabled || !terms) return;
  
  // 取得所有文字節點
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        if (shouldIgnoreElement(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  // 處理每個文字節點
  textNodes.forEach(textNode => {
    let text = textNode.textContent;
    let hasMatch = false;
    let newText = text;
    
    // 檢查是否包含任何需要標示的用語
    for (const term in terms) {
      if (text.includes(term)) {
        hasMatch = true;
        const highlightClass = terms[term].isCustom ? 'custom-term-highlight' : 'cn-term-highlight';
        const prefix = terms[term].isCustom ? '建議使用：' : '台灣慣用：';
        
        // 使用正則表達式來確保完整匹配單詞
        const regex = new RegExp(term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
        newText = newText.replace(regex, 
          `<span class="${highlightClass}" data-replacement="${terms[term].replacement}" data-prefix="${prefix}">${term}</span>`);
      }
    }
    
    // 如果有匹配項，替換原始節點
    if (hasMatch) {
      const span = document.createElement('span');
      span.innerHTML = newText;
      textNode.parentNode.replaceChild(span, textNode);
    }
  });
}

// 處理滑鼠移入事件
document.body.addEventListener('mouseover', (e) => {
  if (!isEnabled) return;
  
  const target = e.target;
  if (target.classList.contains('cn-term-highlight') || target.classList.contains('custom-term-highlight')) {
    const replacement = target.getAttribute('data-replacement');
    const prefix = target.getAttribute('data-prefix');
    tooltip.textContent = `${prefix}${replacement}`;
    tooltip.style.display = 'block';
    
    // 設定tooltip位置
    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 5;
    
    // 確保tooltip不會超出視窗範圍
    if (left + tooltip.offsetWidth > viewportWidth) {
      left = viewportWidth - tooltip.offsetWidth - 10;
    }
    if (top + tooltip.offsetHeight > viewportHeight) {
      top = rect.top + window.scrollY - tooltip.offsetHeight - 5;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
});

// 處理滑鼠移出事件
document.body.addEventListener('mouseout', (e) => {
  if (e.target.classList.contains('cn-term-highlight') || 
      e.target.classList.contains('custom-term-highlight')) {
    tooltip.style.display = 'none';
  }
});

// 監聽開關狀態變更
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.enabled) {
    isEnabled = changes.enabled.newValue;
    if (!isEnabled) {
      // 移除所有高亮
      document.querySelectorAll('.cn-term-highlight, .custom-term-highlight').forEach(el => {
        const text = document.createTextNode(el.textContent);
        el.parentNode.replaceChild(text, el);
      });
      tooltip.style.display = 'none';
    } else if (termsMap) {
      // 重新高亮
      highlightTerms(termsMap);
    }
  }
});

// 定期重新掃描頁面
function scheduleCheck() {
  if (isEnabled && termsMap) {
    highlightTerms(termsMap);
  }
  setTimeout(scheduleCheck, 2000); // 每2秒檢查一次
}

// 初始化
async function initialize() {
  // 獲取開關狀態
  const { enabled = true } = await chrome.storage.local.get('enabled');
  isEnabled = enabled;
  
  // 獲取詞彙對照表
  chrome.runtime.sendMessage({ action: 'getTerms' }, response => {
    if (response && response.terms) {
      termsMap = response.terms;
      highlightTerms(termsMap);
      
      // 開始觀察 DOM 變化
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // 開始定期檢查
      scheduleCheck();
    }
  });
}

// 當網頁完全載入後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
