document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('status');
  const optionsLink = document.getElementById('optionsLink');

  chrome.storage.local.get(['enabled'], (result) => {
    toggleSwitch.checked = result.enabled !== false;
    updateStatus(toggleSwitch.checked);
  });

  // 打开设置页面 (options.html)
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  toggleSwitch.addEventListener('change', () => {
    const enabled = toggleSwitch.checked;
    chrome.storage.local.set({ enabled });
    updateStatus(enabled);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggle',
          enabled: enabled
        });
      }
    });
  });

  function updateStatus(enabled) {
    statusText.textContent = enabled ? '已启用' : '已禁用';
  }
});
