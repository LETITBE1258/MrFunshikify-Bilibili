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

// 在封面容器中查找时间戳遮罩元素，返回 { element, target }
// element: 实际的时间戳元素；target: 容器内应在 overlay 之前的直接子元素
function findBadgeInContainer(container) {
  // 策略1: 已知的 Bilibili 时间戳类名（直接子元素）
  for (const sel of ['.bili-video-card__mask', '.duration', '.time']) {
    const el = container.querySelector(`:scope > ${sel}`);
    if (el) return { element: el, target: el };
  }

  // 策略1b: 已知类名，非直接子元素（如历史页 .bili-cover-card__stats）
  for (const sel of ['.bili-cover-card__stats', '.bili-cover-card__stat']) {
    const el = container.querySelector(sel);
    if (el && container.contains(el)) {
      let cur = el.parentNode;
      while (cur && cur.parentNode !== container) {
        cur = cur.parentNode;
      }
      if (cur && cur.parentNode === container) return { element: el, target: cur };
    }
  }

  // 策略2: 查找包含时间文本的叶子元素，回溯到直接子元素
  const allElements = container.querySelectorAll('*');
  for (const el of allElements) {
    if (el.childElementCount === 0) {
      const text = el.textContent?.trim() || '';
      // 匹配 mm:ss 或 mm:ss/mm:ss（当前进度/总时长）等格式
      if (/^\d{1,2}:\d{2}(\/\d{1,2}:\d{2})?$/.test(text)) {
        let cur = el;
        while (cur.parentNode && cur.parentNode !== container) {
          cur = cur.parentNode;
        }
        if (cur.parentNode === container) return { element: el, target: cur };
      }
    }
  }

  return null;
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
    pointer-events: none !important;
  `;

  // 首页布局检测：有 image--wrap 和 mask 时插入两者之间
  const imageWrap = thumbnailElement.querySelector(':scope > .bili-video-card__image--wrap');
  const mask = thumbnailElement.querySelector(':scope > .bili-video-card__mask');
  if (imageWrap && mask) {
    overlayDiv.style.zIndex = '1';
    thumbnailElement.insertBefore(overlayDiv, mask);
  } else {
    // 其他页面：查找时间戳遮罩元素，将图层插入到它之前
    const badgeInfo = findBadgeInContainer(thumbnailElement);
    if (badgeInfo) {
      thumbnailElement.insertBefore(overlayDiv, badgeInfo.target);
      const badgeZ = parseInt(getComputedStyle(badgeInfo.element).zIndex);
      if (!isNaN(badgeZ) && badgeZ > 0) {
        overlayDiv.style.zIndex = String(badgeZ - 1);
      }
      // 若时间戳无显式 z-index (auto)，overlay 也不设 z-index，
      // 利用 position:absolute 和 DOM 顺序保证时间戳在更上层
    } else {
      overlayDiv.style.zIndex = '10';
      thumbnailElement.appendChild(overlayDiv);
    }
  }
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
  if (thumbnails.length > 0) {
    console.log(`[MrFunshikify] 找到 ${thumbnails.length} 个封面`);
  }
  thumbnails.forEach(thumbnail => {
    const imgUrl = getRandomImage();
    console.log(`[MrFunshikify] 应用: ${imgUrl}`);
    applyOverlay(thumbnail);
  });
}

let pollIntervalId = null;
const POLL_INTERVAL_MS = 5000;

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      setTimeout(applyOverlayToThumbnails, 200);
      break;
    }
  }
});

function startPolling() {
  if (pollIntervalId) return;
  pollIntervalId = setInterval(applyOverlayToThumbnails, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

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

  startPolling();

  // 页面不可见时暂停轮询，减少后台标签页的CPU浪费
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      applyOverlayToThumbnails();
      startPolling();
    }
  });
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
