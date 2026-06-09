# Obsidian TTS

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
| 百度智能云 TTS | 国内，多种发音人 |
| 阿里云 CosyVoice | 国内，45+ 音色，支持方言/SSML/指令控制 |

## 功能

- 朗读当前笔记 / 选中文本
- 浮动播放器（播放 / 暂停 / 停止）
- 播放队列
- 长文自动分段合成
- MP3 导出并嵌入笔记（桌面版）
- Markdown 文本预处理

## 开发

```bash
npm install
npm run dev
```

将项目链接到 Obsidian 插件目录：

```bash
ln -s $(pwd) /path/to/vault/.obsidian/plugins/obsidian-tts
```

## Edge TTS 说明

由于微软政策收紧，浏览器环境无法直接 WSS 连接。本插件在桌面版使用 `edge-tts-universal` 的 Node.js 入口直连；若失败可配置代理 URL（如 [openai-edge-tts](https://github.com/travisvn/openai-edge-tts)）。

## License

MIT
