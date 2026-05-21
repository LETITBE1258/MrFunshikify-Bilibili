const IMAGES_PATH = "images/";
const OVERLAY_CLASS = "mrbeastify-bilibili-overlay";
const TOTAL_IMAGES = 60;

let extensionIsDisabled = false;

function getRandomImage() {
  const randomIndex = Math.floor(Math.random() * TOTAL_IMAGES) + 1;
  return chrome.runtime.getURL(`${IMAGES_PATH}${randomIndex}.png`);
}

function applyOverlay(thumbnailElement) {
  if (!thumbnailElement) return;
  if (thumbnailElement.classList.contains(OVERLAY_CLASS)) return;
  if (thumbnailElement.querySelector(`.${OVERLAY_CLASS}`)) return;

  const mrbeastImage = getRandomImage();

  thumbnailElement.classList.add(OVERLAY_CLASS);
  
  if (getComputedStyle(thumbnailElement).position === 'static') {
    thumbnailElement.style.position = 'relative';
  }
  thumbnailElement.style.overflow = 'hidden';

  const overlayDiv = document.createElement('div');
  overlayDiv.className = OVERLAY_CLASS;
  overlayDiv.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background-image: url(${mrbeastImage}) !important;
    background-size: contain !important;
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
           !thumbnail.querySelector(`.${OVERLAY_CLASS}`);
  });
}

function applyOverlayToThumbnails() {
  if (extensionIsDisabled) return;

  const thumbnails = findThumbnails();
  thumbnails.forEach(thumbnail => {
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

chrome.storage.local.get(['enabled'], (result) => {
  if (result.enabled !== undefined) {
    extensionIsDisabled = !result.enabled;
  }

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
  }
});
