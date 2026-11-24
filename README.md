# 星光予你 · 给小雨宝宝的圣诞树

一个可以用摄像头手势控制的三维粒子圣诞礼物。默认祝福是「小雨宝宝，我爱你」。

线上礼物：https://chrisocling.github.io/starlit-christmas/

源码仓库：https://github.com/chrisocling/starlit-christmas

本项目通过 GitHub Pages 的 `gh-pages` 分支发布；`main` 分支保存源码。修改源码后运行 `npm run build`，再将 `dist/` 的完整内容更新到 `gh-pages` 分支即可重新发布。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

在终端显示的 localhost 地址打开。请通过 http://localhost 或 http://127.0.0.1 访问；直接双击 HTML 文件无法启用模块和摄像头。

## 操作

- 点击「开启手势魔法」，允许摄像头权限。仅使用摄像头，不请求麦克风。
- 张开手掌：粒子散为星空；握拳：聚回圣诞树；拇指和食指捏合：粒子化为爱心，显示专属祝福。
- 将整只手放入画面，尽量保持明亮。手势稳定约 0.3 秒后生效，防止闪烁。
- 左右移动手掌也能旋转树。可随时关闭摄像头。
- 无摄像头时可直接点底部三个按钮；键盘 1、2、3 也能切换。
- 拖动旋转，滚轮或双指缩放；双击画面让星光闪耀。
- 画布获得焦点时，可用左右方向键旋转、加减号缩放、空格切换聚散、回车触发闪耀。
- 右侧可切换鎏金、绯红、极光三种配色。右上角可开启音乐。
- 点击信封阅读小情书，点击「珍藏这一刻」下载 1400×1700 的 PNG 卡片。

## 修改心意

页面右上角「写给她」可以修改昵称、祝福、信和落款。这些修改保存在当前浏览器的 localStorage 中，其他设备不会同步。

要修改所有访客看到的默认内容，请编辑 `src/main.js` 的 `defaults`，并同时更新 `index.html` 中的初始昵称、标题和描述，然后重新构建。

## 构建与部署

```sh
npm test
npm run build
npm run preview
```

`dist/` 是完整的静态站点，可部署到支持 HTTPS 的静态托管。请完整保留 `dist/models/` 和 `dist/vendor/wasm/`；手势模型和 WASM 都随站点托管，无需运行时访问第三方 CDN。首次开启手势需要加载约 20 MB 模型与运行库。

摄像头需要 HTTPS 安全上下文（localhost 例外）和浏览器授权。在内嵌浏览器中权限不可用时，请使用系统 Chrome 或 Safari 打开。手机端提供完整的触控替代操作。

## 实现

Three.js 负责约 1–2 万粒子、GPU 形态插值、Bloom、缎带、星星、礼物和雪；Anime.js 负责入场和形态过渡；MediaPipe Hand Landmarker 在浏览器本地定位手部，使用比例与关节角判定手势。音乐通过 Web Audio 合成，不依赖音频文件。

画面不会上传，站点没有后端、跟踪脚本或分析服务。关闭摄像头、退出页面会停止媒体轨道。页面隐藏时暂停绘制和检测。降低动态效果的系统设置会关闭自动飘动并缩短变形动画。

`npm test` 检查三种手势、旋转缩放不变性、无效输入和稳定防抖逻辑。摄像头在真机上的识别效果仍取决于光线、姿势和设备性能。

依赖的上游项目：Three.js（MIT）、Anime.js（MIT）、Google MediaPipe（Apache-2.0）、Cormorant Garamond 字体（SIL OFL 1.1）。手部模型来自 Google 官方 MediaPipe 模型资源。
