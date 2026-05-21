const IMAGES_PATH = "images/";
const OVERLAY_CLASS = "mrbeastify-bilibili-overlay";
const TOTAL_IMAGES = 66;

let extensionIsDisabled = false;
let appearanceProbability = 100;  // 0-100
let stickerSize = 100;            // 50-200 (%)

function getRandomImage() {
  const randomIndex = Math.floor(Math.random() * TOTAL_IMAGES) + 1;
  return chrome.runtime.getURL(`${IMAGES_PATH}${randomIndex}.png`);
}

function applyOverlay(thumbnailElement) {
  if (!thumbnailElement) return;
  if (thumbnailElement.classList.contains(OVERLAY_CLASS)) return;
  if (thumbnailElement.querySelector(`.${OVERLAY_CLASS}`)) return;
  if (thumbnailElement.dataset.mrbeastifyChecked === 'true') return;

  // 概率检查 — 没中的标记为已检，避免重复抽签
  if (Math.random() * 100 >= appearanceProbability) {
    thumbnailElement.dataset.mrbeastifyChecked = 'true';
    return;
  }

  const mrbeastImage = getRandomImage();
  console.log(`[MrFunshikify] 应用图片: ${mrbeastImage}`);

  thumbnailElement.classList.add(OVERLAY_CLASS);

  if (getComputedStyle(thumbnailElement).position === 'static') {
    thumbnailElement.style.position = 'relative';
  }
  thumbnailElement.style.overflow = 'hidden';

  // Sticker Size: 100% -> contain; else use percentage
  const bgSize = stickerSize === 100 ? 'contain' : `${stickerSize}%`;

  const overlayDiv = document.createElement('div');
  overlayDiv.className = OVERLAY_CLASS;
  overlayDiv.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background-image: url(${mrbeastImage}) !important;
    background-size: ${bgSize} !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
    z-index: 10 !important;
    pointer-events: none !important;
  `;

  thumbnailElement.appendChild(overlayDiv);
}

function findThumbnails() {
  const selectors = [
    ".bili-video-card__cover",
    ".video-card .cover",
    ".small-item .cover",
    ".recommend-item .cover",
    ".video-list .cover",
    ".feed-card .cover",
    ".bili-dyn-card-video .bili-dyn-card-video__left",
    ".bili-dyn-card-video .bili-dyn-card-video__cover",
    ".search-page .cover",
    ".rank-list .cover",
    ".channel-list .cover",
    ".video-img",
    ".lazy-img",
    ".pic",
    ".cover-img",
    "img.cover",
    "a.cover"
  ];

  const allThumbnails = [];
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => allThumbnails.push(el));
    } catch (e) {
      // Ignore invalid selectors
    }
  }

  return allThumbnails.filter(thumbnail => {
    return !thumbnail.classList.contains(OVERLAY_CLASS) &&
           !thumbnail.querySelector(`.${OVERLAY_CLASS}`) &&
           thumbnail.dataset.mrbeastifyChecked !== 'true';
  });
}

function applyOverlayToThumbnails() {
  if (extensionIsDisabled) return;

  const thumbnails = findThumbnails();
  console.log(`[MrFunshikify] 找到 ${thumbnails.length} 个封面`);
  thumbnails.forEach(thumbnail => {
    const imgUrl = getRandomImage();
    console.log(`[MrFunshikify] 应用: ${imgUrl}`);
    applyOverlay(thumbnail);
  });
}

const observer = new MutationObserver((mutations) => {
  let shouldProcess = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldProcess = true;
      break;
    }
  }
  if (shouldProcess) {
    setTimeout(applyOverlayToThumbnails, 200);
  }
});

function init() {
  console.log('[MrBeastify Bilibili] 插件已加载 (PNG图层模式)');
  applyOverlayToThumbnails();

  const target = document.body || document.documentElement;
  if (target) {
    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  setInterval(applyOverlayToThumbnails, 1500);
}

// 读取所有设置
chrome.storage.local.get(['enabled', 'probability', 'stickerSize'], (result) => {
  if (result.enabled !== undefined) {
    extensionIsDisabled = !result.enabled;
  }
  if (result.probability !== undefined) {
    appearanceProbability = result.probability;
  }
  if (result.stickerSize !== undefined) {
    stickerSize = result.stickerSize;
  }

  console.log(`[MrFunshikify] 设置: probability=${appearanceProbability}%, stickerSize=${stickerSize}%`);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 1000);
    });
  } else {
    setTimeout(init, 1000);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle') {
    extensionIsDisabled = !request.enabled;
    if (request.enabled) {
      document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(el => el.remove());
      document.querySelectorAll('.mrbeastify-bilibili-overlay').forEach(el => {
        el.classList.remove('mrbeastify-bilibili-overlay');
      });
      applyOverlayToThumbnails();
    }
  } else if (request.action === 'updateSettings') {
    if (request.probability !== undefined) appearanceProbability = request.probability;
    if (request.stickerSize !== undefined) stickerSize = request.stickerSize;
    console.log(`[MrFunshikify] 设置已更新: probability=${appearanceProbability}%, stickerSize=${stickerSize}%`);
  }
});
