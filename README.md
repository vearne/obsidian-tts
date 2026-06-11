# Obsidian TTS

[English](README.en.md)

多 Provider 语音朗读 Obsidian 插件，支持朗读笔记或选中文本。

## 支持的 Provider

| Provider | 说明 |
|----------|------|
| **Edge TTS**（默认） | 免费，桌面 Node 直连 + 可选代理 fallback |
| OpenAI TTS | 官方 API |
| OpenAI 兼容 API | OneAPI、openai-edge-tts 等 |
| Azure Speech | 微软官方语音服务 |
| Google Cloud TTS | 谷歌云语音合成 |
| ElevenLabs | 高质量 AI 语音 |
| 智谱 GLM-TTS | 国内，情感表达好 |
| 阿里云 CosyVoice | 国内，45+ 音色，支持方言/SSML/指令控制 |

## 功能

- 朗读当前笔记 / 选中文本
- 浮动播放器（播放 / 暂停 / 停止）
- 播放队列
- 长文自动分段合成
- MP3 导出并嵌入笔记（桌面版）
- Markdown 文本预处理

## 本地安装

从源码安装（社区插件未上架、需要最新 commit，或自行修改后使用）：

**前置条件：** [Node.js](https://nodejs.org/)（建议 18+）、npm、Git。

1. **克隆并构建**

```bash
git clone https://github.com/vearne/obsidian-tts.git
cd obsidian-tts
npm install
npm run build
```

构建成功后会在项目根目录生成 `main.js`（该文件在 `.gitignore` 中，需本地构建）。

2. **安装到 Obsidian 库**

Obsidian 插件目录为 `<你的库>/.obsidian/plugins/obsidian-tts/`。任选一种方式：

**方式 A：复制（推荐，适合普通使用）**

```bash
mkdir -p /path/to/vault/.obsidian/plugins/obsidian-tts
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-tts/
```

**方式 B：符号链接（适合开发，改代码后重新 build 即可生效）**

```bash
ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/obsidian-tts
```

将 `/path/to/vault` 替换为你的 Obsidian 库路径（macOS 常见为 `~/Documents/Obsidian/库名`）。

3. **在 Obsidian 中启用**

打开 **设置 → 社区插件**，关闭「安全模式」，在已安装插件列表中找到 **Obsidian TTS** 并启用。

> 更新插件时：在仓库目录执行 `git pull && npm install && npm run build`，若使用复制方式需再次执行 `cp` 覆盖三个文件。

## 开发

开发时可使用 watch 模式，保存源码后自动重新打包：

```bash
npm install
npm run dev
```

配合上面的**方式 B**符号链接，构建产物会直接出现在插件目录中。

## Edge TTS 说明

由于微软政策收紧，浏览器环境无法直接 WSS 连接。本插件在桌面版使用 `edge-tts-universal` 的 Node.js 入口直连；若失败可配置代理 URL（如 [openai-edge-tts](https://github.com/travisvn/openai-edge-tts)）。

## License

MIT
