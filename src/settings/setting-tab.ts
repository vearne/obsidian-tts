import { App, Notice, Platform, TFile } from "obsidian";
import type ObsidianTtsPlugin from "../main";
import {
	DEFAULT_SETTINGS,
	ObsidianTtsSettings,
	PROVIDER_LABELS,
	ProviderId,
	EDGE_VOICES,
	OPENAI_VOICES,
	ZHIPU_VOICES,
	BAIDU_VOICES,
} from "./types";

export class ObsidianTtsSettingTab extends PluginSettingTab {
	private plugin: ObsidianTtsPlugin;

	constructor(app: App, plugin: ObsidianTtsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Obsidian TTS 设置" });

		this.addProviderSelector();
		this.addGeneralSettings();
		this.addEdgeSettings();
		this.addOpenAISettings();
		this.addOpenAICompatibleSettings();
		this.addAzureSettings();
		this.addGoogleSettings();
		this.addElevenLabsSettings();
		this.addZhipuSettings();
		this.addBaiduSettings();
		this.addTextFilteringSettings();
		if (!Platform.isMobile) {
			this.addMp3ExportSettings();
		}
	}

	private addProviderSelector(): void {
		new Setting(this.containerEl)
			.setName("TTS Provider")
			.setDesc("选择语音合成服务")
			.addDropdown((dropdown) => {
				for (const [id, label] of Object.entries(PROVIDER_LABELS)) {
					dropdown.addOption(id, label);
				}
				dropdown.setValue(this.plugin.settings.activeProvider);
				dropdown.onChange(async (value) => {
					this.plugin.settings.activeProvider = value as ProviderId;
					await this.plugin.saveSettings();
					this.plugin.ttsEngine.updateSettings(this.plugin.settings);
				});
			});
	}

	private addGeneralSettings(): void {
		new Setting(this.containerEl)
			.setName("语速")
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 2.0, 0.1)
					.setValue(this.plugin.settings.playbackSpeed)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.playbackSpeed = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName("显示通知")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showNotices).onChange(async (v) => {
					this.plugin.settings.showNotices = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(this.containerEl)
			.setName("显示状态栏按钮")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showStatusBarButton).onChange(async (v) => {
					this.plugin.settings.showStatusBarButton = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(this.containerEl)
			.setName("启用播放队列")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableQueueFeature).onChange(async (v) => {
					this.plugin.settings.enableQueueFeature = v;
					await this.plugin.saveSettings();
				})
			);
	}

	private addEdgeSettings(): void {
		this.containerEl.createEl("h3", { text: "Edge TTS" });

		new Setting(this.containerEl)
			.setName("音色")
			.addDropdown((d) => {
				for (const v of EDGE_VOICES) d.addOption(v, v);
				d.setValue(this.plugin.settings.edge.voice);
				d.onChange(async (v) => {
					this.plugin.settings.edge.voice = v;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName("连接模式")
			.setDesc("自动：桌面直连，失败时降级到代理；移动端使用代理")
			.addDropdown((d) => {
				d.addOption("auto", "自动");
				d.addOption("direct", "仅直连");
				d.addOption("proxy", "仅代理");
				d.setValue(this.plugin.settings.edge.connectionMode);
				d.onChange(async (v) => {
					this.plugin.settings.edge.connectionMode = v as ObsidianTtsSettings["edge"]["connectionMode"];
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName("代理 URL")
			.setDesc("openai-edge-tts 等服务地址，如 http://localhost:5050/v1")
			.addText((t) =>
				t
					.setPlaceholder("http://localhost:5050/v1")
					.setValue(this.plugin.settings.edge.proxyUrl)
					.onChange(async (v) => {
						this.plugin.settings.edge.proxyUrl = v;
						await this.plugin.saveSettings();
					})
			);
	}

	private addOpenAISettings(): void {
		this.containerEl.createEl("h3", { text: "OpenAI TTS" });
		this.addSecretInput("API Key", this.plugin.settings.openai.apiKey, async (v) => {
			this.plugin.settings.openai.apiKey = v;
			await this.plugin.saveSettings();
		});
		new Setting(this.containerEl)
			.setName("Model")
			.addDropdown((d) => {
				d.addOption("tts-1", "tts-1");
				d.addOption("tts-1-hd", "tts-1-hd");
				d.setValue(this.plugin.settings.openai.model);
				d.onChange(async (v) => {
					this.plugin.settings.openai.model = v;
					await this.plugin.saveSettings();
				});
			});
		new Setting(this.containerEl)
			.setName("Voice")
			.addDropdown((d) => {
				for (const v of OPENAI_VOICES) d.addOption(v, v);
				d.setValue(this.plugin.settings.openai.voice);
				d.onChange(async (v) => {
					this.plugin.settings.openai.voice = v;
					await this.plugin.saveSettings();
				});
			});
	}

	private addOpenAICompatibleSettings(): void {
		this.containerEl.createEl("h3", { text: "OpenAI 兼容 API" });
		this.addSecretInput(
			"API Key",
			this.plugin.settings.openaiCompatible.apiKey,
			async (v) => {
				this.plugin.settings.openaiCompatible.apiKey = v;
				await this.plugin.saveSettings();
			}
		);
		new Setting(this.containerEl)
			.setName("Base URL")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.openaiCompatible.baseUrl)
					.onChange(async (v) => {
						this.plugin.settings.openaiCompatible.baseUrl = v;
						await this.plugin.saveSettings();
					})
			);
		new Setting(this.containerEl)
			.setName("Model")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.openaiCompatible.model)
					.onChange(async (v) => {
						this.plugin.settings.openaiCompatible.model = v;
						await this.plugin.saveSettings();
					})
			);
		new Setting(this.containerEl)
			.setName("Voice")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.openaiCompatible.voice)
					.onChange(async (v) => {
						this.plugin.settings.openaiCompatible.voice = v;
						await this.plugin.saveSettings();
					})
			);
	}

	private addAzureSettings(): void {
		this.containerEl.createEl("h3", { text: "Azure Speech" });
		this.addSecretInput("API Key", this.plugin.settings.azure.apiKey, async (v) => {
			this.plugin.settings.azure.apiKey = v;
			await this.plugin.saveSettings();
		});
		new Setting(this.containerEl)
			.setName("Region")
			.addText((t) =>
				t.setValue(this.plugin.settings.azure.region).onChange(async (v) => {
					this.plugin.settings.azure.region = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(this.containerEl)
			.setName("Voice")
			.addText((t) =>
				t.setValue(this.plugin.settings.azure.voice).onChange(async (v) => {
					this.plugin.settings.azure.voice = v;
					await this.plugin.saveSettings();
				})
			);
	}

	private addGoogleSettings(): void {
		this.containerEl.createEl("h3", { text: "Google Cloud TTS" });
		this.addSecretInput("API Key", this.plugin.settings.google.apiKey, async (v) => {
			this.plugin.settings.google.apiKey = v;
			await this.plugin.saveSettings();
		});
		new Setting(this.containerEl)
			.setName("Language Code")
			.addText((t) =>
				t.setValue(this.plugin.settings.google.languageCode).onChange(async (v) => {
					this.plugin.settings.google.languageCode = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(this.containerEl)
			.setName("Voice Name")
			.addText((t) =>
				t.setValue(this.plugin.settings.google.voiceName).onChange(async (v) => {
					this.plugin.settings.google.voiceName = v;
					await this.plugin.saveSettings();
				})
			);
	}

	private addElevenLabsSettings(): void {
		this.containerEl.createEl("h3", { text: "ElevenLabs" });
		this.addSecretInput(
			"API Key",
			this.plugin.settings.elevenlabs.apiKey,
			async (v) => {
				this.plugin.settings.elevenlabs.apiKey = v;
				await this.plugin.saveSettings();
			}
		);
		new Setting(this.containerEl)
			.setName("Voice ID")
			.addText((t) =>
				t.setValue(this.plugin.settings.elevenlabs.voiceId).onChange(async (v) => {
					this.plugin.settings.elevenlabs.voiceId = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(this.containerEl)
			.setName("Model ID")
			.addText((t) =>
				t.setValue(this.plugin.settings.elevenlabs.modelId).onChange(async (v) => {
					this.plugin.settings.elevenlabs.modelId = v;
					await this.plugin.saveSettings();
				})
			);
	}

	private addZhipuSettings(): void {
		this.containerEl.createEl("h3", { text: "智谱 GLM-TTS" });
		this.addSecretInput("API Key", this.plugin.settings.zhipu.apiKey, async (v) => {
			this.plugin.settings.zhipu.apiKey = v;
			await this.plugin.saveSettings();
		});
		new Setting(this.containerEl)
			.setName("音色")
			.addDropdown((d) => {
				for (const v of ZHIPU_VOICES) d.addOption(v, v);
				d.setValue(this.plugin.settings.zhipu.voice);
				d.onChange(async (v) => {
					this.plugin.settings.zhipu.voice = v;
					await this.plugin.saveSettings();
				});
			});
		new Setting(this.containerEl)
			.setName("音量")
			.addSlider((s) =>
				s
					.setLimits(0.1, 2.0, 0.1)
					.setValue(this.plugin.settings.zhipu.volume)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.zhipu.volume = v;
						await this.plugin.saveSettings();
					})
			);
	}

	private addBaiduSettings(): void {
		this.containerEl.createEl("h3", { text: "百度智能云 TTS" });
		this.addSecretInput("API Key", this.plugin.settings.baidu.apiKey, async (v) => {
			this.plugin.settings.baidu.apiKey = v;
			await this.plugin.saveSettings();
		});
		this.addSecretInput(
			"Secret Key",
			this.plugin.settings.baidu.secretKey,
			async (v) => {
				this.plugin.settings.baidu.secretKey = v;
				await this.plugin.saveSettings();
			}
		);
		new Setting(this.containerEl)
			.setName("发音人")
			.addDropdown((d) => {
				for (const v of BAIDU_VOICES) {
					d.addOption(String(v.id), v.label);
				}
				d.setValue(String(this.plugin.settings.baidu.voice));
				d.onChange(async (v) => {
					this.plugin.settings.baidu.voice = parseInt(v, 10);
					await this.plugin.saveSettings();
				});
			});
	}

	private addTextFilteringSettings(): void {
		this.containerEl.createEl("h3", { text: "文本过滤" });
		const f = this.plugin.settings.textFiltering;
		const toggles: [keyof typeof f, string][] = [
			["filterFrontmatter", "过滤 YAML frontmatter"],
			["filterMarkdownLinks", "过滤 Markdown 链接"],
			["filterCodeBlocks", "过滤代码块"],
			["filterInlineCode", "过滤行内代码"],
			["filterHtmlTags", "过滤 HTML 标签"],
			["filterImages", "过滤图片"],
			["filterWikiLinks", "保留 Wikilink 文本"],
			["filterCallouts", "过滤 Callout"],
		];
		for (const [key, label] of toggles) {
			new Setting(this.containerEl)
				.setName(label)
				.addToggle((t) =>
					t.setValue(f[key]).onChange(async (v) => {
						this.plugin.settings.textFiltering[key] = v;
						await this.plugin.saveSettings();
					})
				);
		}
	}

	private addMp3ExportSettings(): void {
		this.containerEl.createEl("h3", { text: "MP3 导出（桌面）" });
		new Setting(this.containerEl)
			.setName("启用 MP3 导出")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.mp3Export.enabled).onChange(async (v) => {
					this.plugin.settings.mp3Export.enabled = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(this.containerEl)
			.setName("输出文件夹")
			.addText((t) =>
				t.setValue(this.plugin.settings.mp3Export.outputFolder).onChange(async (v) => {
					this.plugin.settings.mp3Export.outputFolder = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(this.containerEl)
			.setName("嵌入到笔记")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.mp3Export.embedInNote).onChange(async (v) => {
					this.plugin.settings.mp3Export.embedInNote = v;
					await this.plugin.saveSettings();
				})
			);
	}

	private addSecretInput(
		name: string,
		value: string,
		onChange: (v: string) => Promise<void>
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.addText((t) => {
				t.inputEl.type = "password";
				t.setValue(value).onChange(onChange);
			});
	}
}

// Re-export for type usage - fix import
import { PluginSettingTab, Setting } from "obsidian";
