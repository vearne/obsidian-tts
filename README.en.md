# Obsidian TTS

[中文](README.md)

An Obsidian plugin that reads notes aloud with multiple TTS providers. Supports reading the current note or selected text.

## Supported Providers

| Provider | Description |
|----------|-------------|
| **Edge TTS** (default) | Free; desktop Node direct connection with optional proxy fallback |
| OpenAI TTS | Official OpenAI API |
| OpenAI-compatible API | OneAPI, openai-edge-tts, etc. |
| Azure Speech | Microsoft cloud speech service |
| Google Cloud TTS | Google cloud text-to-speech |
| ElevenLabs | High-quality AI voices |
| Zhipu GLM-TTS | China-based; expressive emotional speech |
| Aliyun CosyVoice | China-based; 45+ voices, dialects, SSML, and instruction control |

## Features

- Read the current note or selected text aloud
- Floating player (play / pause / stop)
- Playback queue
- Automatic chunking for long text
- MP3 export and embed in notes (desktop only)
- Markdown text preprocessing

## Development

```bash
npm install
npm run dev
```

Symlink the project into your Obsidian plugins folder:

```bash
ln -s $(pwd) /path/to/vault/.obsidian/plugins/obsidian-tts
```

## Edge TTS Notes

Due to tightened Microsoft policies, direct WSS connections are not available in browser environments. On desktop, this plugin uses the Node.js entry point of `edge-tts-universal` for direct connections. If that fails, configure a proxy URL (e.g. [openai-edge-tts](https://github.com/travisvn/openai-edge-tts)).

## License

MIT
