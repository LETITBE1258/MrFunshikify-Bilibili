const DEFAULTS = {
  enabled: true,
  probability: 100,
  stickerSize: 100
};

document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const probSlider = document.getElementById('probability');
  const probVal = document.getElementById('probVal');
  const sizeSlider = document.getElementById('stickerSize');
  const sizeVal = document.getElementById('sizeVal');
  const imageCountEl = document.getElementById('imageCount');
  const versionEl = document.getElementById('version');
  const totalImagesEl = document.getElementById('totalImages');
  const extIdEl = document.getElementById('extId');

  extIdEl.textContent = chrome.runtime.id;
  versionEl.textContent = chrome.runtime.getManifest().version;

  // 读取所有设置
  chrome.storage.local.get(['enabled', 'probability', 'stickerSize'], (result) => {
    toggleSwitch.checked = result.enabled !== false;
    probSlider.value = result.probability ?? DEFAULTS.probability;
    sizeSlider.value = result.stickerSize ?? DEFAULTS.stickerSize;
    updateLabels();
  });

  function updateLabels() {
    probVal.textContent = `${probSlider.value}%`;
    const x = (sizeSlider.value / 100).toFixed(1);
    sizeVal.textContent = `${x}x`;
  }

  // 保存函数
  function saveSetting(key, value) {
    chrome.storage.local.set({ [key]: value });
  }

  // 事件
  toggleSwitch.addEventListener('change', () => {
    const enabled = toggleSwitch.checked;
    chrome.storage.local.set({ enabled });
    chrome.tabs.query({ url: '*://*.bilibili.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'toggle', enabled }).catch(() => {});
      });
    });
  });

  function sendSettingsToTabs() {
    const data = {
      action: 'updateSettings',
      probability: parseInt(probSlider.value),
      stickerSize: parseInt(sizeSlider.value)
    };
    chrome.tabs.query({ url: '*://*.bilibili.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, data).catch(() => {});
      });
    });
  }

  probSlider.addEventListener('input', () => {
    updateLabels();
    saveSetting('probability', parseInt(probSlider.value));
    sendSettingsToTabs();
  });

  sizeSlider.addEventListener('input', () => {
    updateLabels();
    saveSetting('stickerSize', parseInt(sizeSlider.value));
    sendSettingsToTabs();
  });

  // 图片数量检测
  function countImages() {
    let count = 0;
    function check(n) {
      const url = chrome.runtime.getURL(`images/${n}.png`);
      fetch(url, { method: 'HEAD' }).then(r => {
        if (r.ok) { count = n; check(n + 1); }
        else { imageCountEl.textContent = count; totalImagesEl.textContent = count; }
      }).catch(() => {
        imageCountEl.textContent = count || '?';
        totalImagesEl.textContent = count || '?';
      });
    }
    check(1);
  }
  countImages();
});
