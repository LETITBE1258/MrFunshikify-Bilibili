# Greasy Fork 更新教程

如果你在用 Tampermonkey（油猴脚本版），每次修改代码或添加图片后，按以下 4 步同步到 Greasy Fork。

---

## 第 1 步：生成新脚本

双击运行 `scripts/build_userscript.py`，或者打开终端粘贴这一行：

```
python scripts/build_userscript.py
```

如果加了新图片，想顺便升级版本号，用：

```
python scripts/build_userscript.py --bump patch
```

一切正常的话，你会看到 `dist/mrfunshikify.user.js` 文件被更新了。

---

## 第 2 步：复制到 Greasy Fork

1. 打开 `dist` 文件夹里的 `mrfunshikify.user.js`
2. 全选复制（Ctrl+A → Ctrl+C）
3. 打开 [greasyfork.org](https://greasyfork.org)
4. 点你的头像 → 你的脚本 → 点右边的 **编辑**
5. 在编辑页面全选（Ctrl+A）替换掉旧代码 → 粘贴（Ctrl+V）
6. 拉到页面最底下，点 **保存**

---

## 第 3 步：推送到 GitHub

打开 **GitHub Desktop**（绿色图标那个软件）：

1. 左边会看到有改动的文件列表
2. 底部的 Summary 写个说明（比如"更新了图片"或"修了个bug"）
3. 点 **Commit to main**
4. 点右上角的 **Push origin**

---

## 第 4 步：图片上传到 CDN（这一步可选）

如果你**没有新增图片**，这步跳过。

如果你用 Plugin 工具加了新图片：

```
git add images/
git push
```

jsDelivr CDN 会自动清理缓存，等几分钟新图片就会生效。

---

## 总结

```
改代码或加图 → 跑 build_userscript.py → 复制到 Greasy Fork → GitHub 推送
```

全程大概 1 分钟。
