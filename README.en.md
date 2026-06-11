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

## Local Installation

Install from source (when the plugin is not in Community Plugins, you need the latest commit, or you have local changes):

**Prerequisites:** [Node.js](https://nodejs.org/) (18+ recommended), npm, and Git.

1. **Clone and build**

```bash
git clone https://github.com/vearne/obsidian-tts.git
cd obsidian-tts
npm install
npm run build
```

This generates `main.js` in the project root (gitignored; you must build locally).

2. **Install into your vault**

The plugin folder is `<your-vault>/.obsidian/plugins/obsidian-tts/`. Choose one approach:

**Option A: Copy (recommended for regular use)**

```bash
mkdir -p /path/to/vault/.obsidian/plugins/obsidian-tts
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-tts/
```

**Option B: Symlink (for development; rebuild to pick up changes)**

```bash
ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/obsidian-tts
```

Replace `/path/to/vault` with your Obsidian vault path.

3. **Enable in Obsidian**

Go to **Settings → Community plugins**, turn off Restricted mode, find **Obsidian TTS** in the installed list, and enable it.

> To update: run `git pull && npm install && npm run build` in the repo; if you used copy, run `cp` again to overwrite the three files.

## Development

For development, use watch mode so the bundle rebuilds on save:

```bash
npm install
npm run dev
```

Use **Option B** (symlink) above so rebuilt artifacts are picked up automatically.

## Edge TTS Notes

Due to tightened Microsoft policies, direct WSS connections are not available in browser environments. On desktop, this plugin uses the Node.js entry point of `edge-tts-universal` for direct connections. If that fails, configure a proxy URL (e.g. [openai-edge-tts](https://github.com/travisvn/openai-edge-tts)).

## License

MIT
