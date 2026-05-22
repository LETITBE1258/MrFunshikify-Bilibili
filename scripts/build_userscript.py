#!/usr/bin/env python3
"""Build a Greasy Fork userscript from the Chrome extension source.

Usage:
  python scripts/build_userscript.py              # normal build
  python scripts/build_userscript.py --bump patch  # bump version + build
  python scripts/build_userscript.py --bump minor  # bump version + build
  python scripts/build_userscript.py --bump major  # bump version + build

Output: dist/mrfunshikify.user.js
"""

import json
import os
import re
import sys
from string import Template

# ── Paths ──────────────────────────────────────────────────────────────────

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_JS = os.path.join(REPO_ROOT, "content.js")
MANIFEST_JSON = os.path.join(REPO_ROOT, "manifest.json")
STYLES_CSS = os.path.join(REPO_ROOT, "styles.css")
OUTPUT_DIR = os.path.join(REPO_ROOT, "dist")
OUTPUT_JS = os.path.join(OUTPUT_DIR, "mrfunshikify.user.js")
CDN_BASE = "https://cdn.jsdelivr.net/gh/LETITBE1258/MrFunshikify-Bilibili/images/"
ICON_URL = CDN_BASE + "icon.png"

# ── Helpers ────────────────────────────────────────────────────────────────


def read_text(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def bump_version(version, part):
    """Bump major, minor, or patch in a semver string."""
    parts = list(map(int, version.split(".")))
    if len(parts) < 3:
        parts += [0] * (3 - len(parts))
    idx = {"major": 0, "minor": 1, "patch": 2}.get(part)
    if idx is None:
        die(f"Invalid bump part: {part}. Use major/minor/patch.")
    parts[idx] += 1
    for i in range(idx + 1, 3):
        parts[i] = 0
    return ".".join(map(str, parts))


# ── Parse args ─────────────────────────────────────────────────────────────

BUMP_PART = None
for arg in sys.argv[1:]:
    if arg == "--bump":
        continue  # handled below
    if arg in ("major", "minor", "patch"):
        BUMP_PART = arg

# ── Phase 1: Parse inputs ─────────────────────────────────────────────────

try:
    manifest = json.loads(read_text(MANIFEST_JSON))
except FileNotFoundError:
    die(f"File not found: {MANIFEST_JSON}")
except json.JSONDecodeError as e:
    die(f"manifest.json is not valid JSON: {e}")

version = manifest.get("version", "0.0.0")

if BUMP_PART:
    new_version = bump_version(version, BUMP_PART)
    manifest["version"] = new_version
    with open(MANIFEST_JSON, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Bumped version: {version} -> {new_version}")
    version = new_version

try:
    content_js = read_text(CONTENT_JS)
except FileNotFoundError:
    die(f"File not found: {CONTENT_JS}")

try:
    styles_css = read_text(STYLES_CSS).strip()
except FileNotFoundError:
    print("WARNING: styles.css not found; skipping CSS injection")
    styles_css = ""

# ── Phase 2: Split content.js at storage boundary ─────────────────────────

STORAGE_MARKER = (
    "chrome.storage.local.get(['enabled', 'probability', 'stickerSize'],"
    " (result) => {"
)
FALLBACK_MARKER = "chrome.storage.local.get("

pos = content_js.find(STORAGE_MARKER)
if pos == -1:
    print("WARNING: exact storage marker not found, trying fallback")
    pos = content_js.find(FALLBACK_MARKER)
if pos == -1:
    die(
        "Could not find chrome.storage.local.get in content.js. "
        "The file may have been restructured."
    )

# Walk backwards to include the comment line above the marker
split_pos = pos
comment_marker = "// 读取所有设置"
comment_pos = content_js.rfind(comment_marker, 0, pos)
if comment_pos != -1 and pos - comment_pos < 80:
    split_pos = comment_pos

core_code = content_js[:split_pos].rstrip()

# ── Phase 3: Transform core section ────────────────────────────────────────

# 3a: IMAGES_PATH constant -> IMAGE_BASE with CDN URL
count = core_code.count('const IMAGES_PATH = "images/";')
if count == 0:
    print("WARNING: 'const IMAGES_PATH' not found in core section")
core_code = core_code.replace(
    'const IMAGES_PATH = "images/";',
    f'const IMAGE_BASE = "{CDN_BASE}";',
)

# 3b: chrome.runtime.getURL -> direct string
count = core_code.count(
    "chrome.runtime.getURL(`${IMAGES_PATH}${randomIndex}.png`)"
)
if count == 0:
    print("WARNING: chrome.runtime.getURL call not found in core section")
core_code = core_code.replace(
    "chrome.runtime.getURL(`${IMAGES_PATH}${randomIndex}.png`)",
    "`${IMAGE_BASE}${randomIndex}.png`",
)

# 3c: Log prefix consistency
core_code = core_code.replace(
    "[MrBeastify Bilibili]", "[MrFunshikify Bilibili]"
)
core_code = core_code.replace("[MrBeastify", "[MrFunshikify")

# ── Phase 4: Generate GM sections ──────────────────────────────────────────

# 4a: Metadata block
metadata_block = Template("""\
// ==UserScript==
// @name         MrFunshikify Bilibili - 泛式封面
// @namespace    https://github.com/LETITBE1258/MrFunshikify-Bilibili
// @version      $version
// @description  将Bilibili视频封面替换为泛式的随机图片
// @author       LETITBE1258
// @match        *://*.bilibili.com/*
// @icon         $icon_url
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @license      WTFPL
// @run-at       document-idle
// ==/UserScript==

""").safe_substitute(version=version, icon_url=ICON_URL)

# 4b: GM_addStyle block
addstyle_block = ""
if styles_css:
    addstyle_block = Template("""\
/* -- CSS Injection --------------------------------------------- */
GM_addStyle(`$css`);

""").safe_substitute(css=styles_css)

# 4c: Storage init block (replaces chrome.storage.local.get)
storage_init_block = """\

/* -- Settings (GM_getValue) ------------------------------------ */
extensionIsDisabled = !GM_getValue('enabled', true);
appearanceProbability = GM_getValue('probability', 100);
stickerSize = GM_getValue('stickerSize', 100);

console.log('[MrFunshikify] 设置: ' + appearanceProbability + '% 概率, ' + stickerSize + '% 大小');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 1000);
  });
} else {
  setTimeout(init, 1000);
}

"""

# 4d: GM_addValueChangeListener block (replaces onMessage)
listeners_block = """\

/* -- Cross-tab sync (GM_addValueChangeListener) ---------------- */
GM_addValueChangeListener('enabled', function(name, oldVal, newVal, remote) {
  extensionIsDisabled = !newVal;
  if (newVal) {
    document.querySelectorAll('.' + OVERLAY_CLASS).forEach(function(el) { el.remove(); });
    document.querySelectorAll('.mrbeastify-bilibili-overlay').forEach(function(el) {
      el.classList.remove('mrbeastify-bilibili-overlay');
    });
    applyOverlayToThumbnails();
  }
});

GM_addValueChangeListener('probability', function(name, oldVal, newVal) {
  appearanceProbability = newVal;
});

GM_addValueChangeListener('stickerSize', function(name, oldVal, newVal) {
  stickerSize = newVal;
});
"""

# 4e: GM_registerMenuCommand block (replaces popup/options UI)
menu_block = """\

/* -- Userscript Menu Commands ---------------------------------- */
(function() {
  function promptSetting(name, label, defaultValue, min, max) {
    var current = GM_getValue(name, defaultValue);
    var raw = prompt('[MrFunshikify] ' + label + ' (' + min + '-' + max + ')', String(current));
    if (raw === null) return;
    var val = parseInt(raw, 10);
    if (!isNaN(val) && val >= min && val <= max) {
      GM_setValue(name, val);
    } else {
      alert('\\u8bf7\\u8f93\\u5165 ' + min + ' \\u5230 ' + max + ' \\u4e4b\\u95f4\\u7684\\u6570\\u503c');
    }
  }

  GM_registerMenuCommand('\\u5207\\u6362\\u542f\\u7528/\\u7981\\u7528', function() {
    var newVal = !GM_getValue('enabled', true);
    GM_setValue('enabled', newVal);
  });

  GM_registerMenuCommand('\\u8bbe\\u7f6e\\u51fa\\u73b0\\u6982\\u7387', function() {
    promptSetting('probability', '\\u51fa\\u73b0\\u6982\\u7387 (%)', 100, 0, 100);
  });

  GM_registerMenuCommand('\\u8bbe\\u7f6e\\u8d34\\u7eb8\\u5927\\u5c0f', function() {
    promptSetting('stickerSize', '\\u8d34\\u7eb8\\u5927\\u5c0f (%)', 100, 50, 200);
  });

  GM_registerMenuCommand('\\u663e\\u793a\\u5f53\\u524d\\u72b6\\u6001', function() {
    var enabled = GM_getValue('enabled', true);
    var prob = GM_getValue('probability', 100);
    var size = GM_getValue('stickerSize', 100);
    alert('\\u72b6\\u6001: ' + (enabled ? '\\u5df2\\u542f\\u7528' : '\\u5df2\\u7981\\u7528') + '\\n\\u6982\\u7387: ' + prob + '%\\n\\u5927\\u5c0f: ' + size + '%');
  });
})();

"""

# ── Phase 5: Assemble ──────────────────────────────────────────────────────

output = (
    metadata_block
    + addstyle_block
    + core_code
    + storage_init_block
    + listeners_block
    + menu_block
)

# ── Phase 6: Write output ──────────────────────────────────────────────────

os.makedirs(OUTPUT_DIR, exist_ok=True)
with open(OUTPUT_JS, "w", encoding="utf-8", newline="\n") as f:
    f.write(output)

line_count = output.count("\n") + 1
print(f"OK  Userscript generated: {OUTPUT_JS}")
print(f"    Version: {version}")
print(f"    Lines:   {line_count}")
