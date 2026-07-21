# Morgan iPhone Teleprompter

一个面向 iPhone Safari 的轻量级提词器 PWA，无后端、无账号、脚本只保存在本机。

## 已实现

- 口播稿编辑与自动本地保存
- 3 秒倒计时
- 自动滚动、暂停、重播
- 滚动速度与字体大小调节
- 镜像显示
- 阅读引导线
- 横屏适配
- 离线缓存
- 添加到 iPhone 主屏幕后可作为独立 App 使用
- 录制时防止屏幕自动息屏（Wake Lock）
- 轻点提词区暂停 / 继续
- 上下滑动手动调整位置，松手后自动续滚
- 完整 PWA 图标（主屏幕图标不再空白）
- 脚本库：多条口播稿保存、切换、重命名、删除
- 导入 TXT / Markdown，自动清洗 Markdown 语法为纯口播文本

## 本地运行

浏览器安全策略要求 PWA 通过 HTTP/HTTPS 运行：

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080`。

## 部署到 GitHub Pages

1. 将全部文件上传到仓库根目录。
2. GitHub 仓库进入 Settings → Pages。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main` 与 `/root`。
5. 保存后等待 Pages 地址生成。

## 下一阶段

- 蓝牙遥控器按键映射
- 语音跟随滚动
- 摄像头悬浮预览
- 多语言界面
