document.addEventListener('DOMContentLoaded', function() {
  const enableSwitch = document.getElementById('enableExtension');
  
  // 載入儲存的開關狀態
  chrome.storage.local.get('enabled', function(data) {
    enableSwitch.checked = data.enabled !== false;
  });
  
  // 監聽開關變更
  enableSwitch.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ enabled: enabled });
  });
});
