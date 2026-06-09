import {
	Editor,
	MarkdownView,
	Menu,
	Notice,
	Platform,
	Plugin,
	TAbstractFile,
	TFile,
} from "obsidian";
import { PlaybackManager } from "./audio/playback-manager";
import { QueueManager } from "./audio/queue-manager";
import {
	DEFAULT_SETTINGS,
	ObsidianTtsSettings,
	ZHIPU_VOICES,
} from "./settings/types";
import { ObsidianTtsSettingTab } from "./settings/setting-tab";
import { TTSEngine } from "./tts/engine";
import { FloatingPlayer } from "./ui/floating-player";
import { QueuePanel } from "./ui/queue-panel";
import {
	embedMp3InNote,
	exportMp3ToVault,
	getAudioFormat,
	getNoteTitle,
	isDesktopExportAvailable,
	sanitizeFileName,
} from "./file/mp3-export";
import { formatError, setDebugEnabled } from "./utils/logger";

export default class ObsidianTtsPlugin extends Plugin {
	settings: ObsidianTtsSettings = DEFAULT_SETTINGS;
	ttsEngine!: TTSEngine;
	playbackManager!: PlaybackManager;
	queueManager!: QueueManager;
	floatingPlayer!: FloatingPlayer;
	queuePanel!: QueuePanel;
	statusBarItem: HTMLElement | null = null;
	private isReading = false;
	private currentQueueItemId: string | null = null;

	async onload() {
		console.log(`Obsidian TTS v${this.manifest.version} loaded`);
		await this.loadSettings();

		this.ttsEngine = new TTSEngine(this.settings);
		this.playbackManager = new PlaybackManager();
		this.queueManager = new QueueManager();

		this.floatingPlayer = new FloatingPlayer(
			() => this.playbackManager.togglePause(),
			() => this.stopReading(),
			this.settings.floatingPlayerPosition,
			(time: number) => this.playbackManager.seek(time),
			() => this.playbackManager.jumpForward(),
			() => this.playbackManager.jumpBackward()
		);

		this.queuePanel = new QueuePanel(
			() => this.queueManager.getAll(),
			(id) => this.queueManager.remove(id),
			() => this.queueManager.clear()
		);

		this.playbackManager.setStateCallback((state) => {
			if (!this.settings.disableFloatingPlayer) {
				this.floatingPlayer.show(state);
				this.floatingPlayer.update(state);
			}
			this.updateStatusBar(state.isPlaying && !state.isPaused);
		});

		this.playbackManager.setOnComplete(() => {
			void this.playNextInQueue();
		});

		this.queueManager.setOnChange(() => this.queuePanel.update());

		this.addSettingTab(new ObsidianTtsSettingTab(this.app, this));

		this.addRibbonIcon("audio-lines", "朗读当前笔记", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) void this.readNote(view.editor, view);
		});

		if (this.settings.showStatusBarButton) {
			this.statusBarItem = this.addStatusBarItem();
			this.statusBarItem.addClass("obsidian-tts-status-bar");
			this.statusBarItem.setText("🔊 TTS");
			this.statusBarItem.onClickEvent(() => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return;
				if (this.isReading) {
					this.playbackManager.togglePause();
				} else {
					void this.readNote(view.editor, view);
				}
			});
		}

		this.registerCommands();
		this.registerFileMenu();
		this.registerEditorMenu();
	}

	onunload() {
		this.stopReading();
		this.floatingPlayer.destroy();
		this.queuePanel.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.migrateSettings();
		setDebugEnabled(this.settings.enableDebugLog);
	}

	private migrateSettings(): void {
		const fmt = this.settings.zhipu.responseFormat as string;
		if (fmt === "mp3" || !(fmt === "wav" || fmt === "pcm")) {
			this.settings.zhipu.responseFormat = "wav";
		}

		const legacyVoice: Record<string, string> = {
			female: "tongtong",
			male: "chuichui",
		};
		const voice = this.settings.zhipu.voice;
		if (legacyVoice[voice]) {
			this.settings.zhipu.voice = legacyVoice[voice];
		}

		const validVoices = new Set(ZHIPU_VOICES.map((v) => v.id));
		if (!validVoices.has(this.settings.zhipu.voice)) {
			this.settings.zhipu.voice = "tongtong";
		}

		this.settings.zhipu.speed = Math.max(0.5, Math.min(2, this.settings.zhipu.speed));
		this.settings.zhipu.volume = Math.max(0.1, Math.min(10, this.settings.zhipu.volume));
	}

	async saveSettings() {
		await this.saveData(this.settings);
		setDebugEnabled(this.settings.enableDebugLog);
		this.ttsEngine.updateSettings(this.settings);
	}

	private registerCommands() {
		this.addCommand({
			id: "read-note-aloud",
			name: "朗读当前笔记",
			editorCallback: (editor, ctx) => {
				if (ctx instanceof MarkdownView) {
					void this.readNote(editor, ctx);
				} else {
					void this.readText(editor.getValue(), "当前笔记");
				}
			},
		});

		this.addCommand({
			id: "read-selection-aloud",
			name: "朗读选中文本",
			editorCheckCallback: (checking, editor) => {
				const sel = editor.getSelection();
				if (!sel.trim()) return false;
				if (!checking) {
					void this.readText(sel, "选中文本");
				}
				return true;
			},
		});

		this.addCommand({
			id: "stop-reading",
			name: "停止朗读",
			callback: () => this.stopReading(),
		});

		this.addCommand({
			id: "show-floating-player",
			name: "显示浮动播放器",
			callback: () => {
				this.floatingPlayer.show({
					isPlaying: this.isReading,
					isPaused: false,
					currentSegment: 0,
					totalSegments: 0,
					title: "",
					currentTime: 0,
					duration: 0,
				});
			},
		});

		if (this.settings.enableQueueFeature) {
			this.addCommand({
				id: "show-queue-panel",
				name: "显示播放队列",
				callback: () => this.queuePanel.show(),
			});

			this.addCommand({
				id: "add-selection-to-queue",
				name: "将选中文本加入播放队列",
				editorCheckCallback: (checking, editor) => {
					const sel = editor.getSelection();
					if (!sel.trim()) return false;
					if (!checking) {
						this.queueManager.add({
							id: `${Date.now()}-selection`,
							title: "选中文本",
							text: sel,
						});
						if (this.settings.showNotices) {
							new Notice("已将选中文本加入队列");
						}
					}
					return true;
				},
			});
		}

		if (isDesktopExportAvailable() && this.settings.mp3Export.enabled) {
			this.addCommand({
				id: "generate-mp3",
				name: "生成 MP3 并嵌入笔记",
				editorCallback: (editor, ctx) => {
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view) {
						void this.generateMp3(editor, view);
					} else {
						void this.exportMp3FromText(editor.getValue(), "note", editor);
					}
				},
			});
		}
	}

	private registerFileMenu() {
		if (!this.settings.showMenuItems) return;

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;

				menu.addItem((item) => {
					item.setTitle("朗读笔记")
						.setIcon("audio-lines")
						.onClick(async () => {
							const content = await this.app.vault.read(file);
							void this.readText(content, file.basename);
						});
				});

				if (this.settings.enableQueueFeature) {
					menu.addItem((item) => {
						item.setTitle("加入播放队列")
							.setIcon("list")
							.onClick(async () => {
								const content = await this.app.vault.read(file);
								this.queueManager.add({
									id: `${Date.now()}-${file.path}`,
									title: file.basename,
									text: content,
									filePath: file.path,
								});
								if (this.settings.showNotices) {
									new Notice(`已加入队列: ${file.basename}`);
								}
							});
					});
				}

				if (
					isDesktopExportAvailable() &&
					this.settings.mp3Export.enabled
				) {
					menu.addItem((item) => {
						item.setTitle("生成 MP3")
							.setIcon("download")
							.onClick(async () => {
								const content = await this.app.vault.read(file);
								const view = this.app.workspace.getActiveViewOfType(MarkdownView);
								if (view?.file?.path === file.path) {
									void this.generateMp3(view.editor, view, content);
								} else {
									void this.exportMp3FromText(
										content,
										file.basename,
										null
									);
								}
							});
					});
				}
			})
		);
	}

	private registerEditorMenu() {
		this.registerEvent(
			this.app.workspace.on(
				"editor-menu",
				(menu: Menu, editor: Editor, view: MarkdownView) => {
					const sel = editor.getSelection();
					if (!sel.trim()) return;

					menu.addItem((item) => {
						item.setTitle("朗读选中文本")
							.setIcon("audio-lines")
							.onClick(() => {
								void this.readText(sel, "选中文本");
							});
					});

					if (this.settings.enableQueueFeature) {
						menu.addItem((item) => {
							item.setTitle("将选中文本加入播放队列")
								.setIcon("list-plus")
								.onClick(() => {
									this.queueManager.add({
										id: `${Date.now()}-selection`,
										title: "选中文本",
										text: sel,
									});
									if (this.settings.showNotices) {
										new Notice("已将选中文本加入队列");
									}
								});
						});
					}
				}
			)
		);
	}

	private async readNote(editor: Editor, view: MarkdownView) {
		const text = editor.getValue();
		const title = getNoteTitle(view.file);
		await this.readText(text, title);
	}

	private async readText(text: string, title: string, isQueueItem = false) {
		if (this.isReading) {
			this.stopReading();
		}

		if (!isQueueItem) {
			this.currentQueueItemId = null;
			this.queuePanel.setHighlightId(null);
		}

		this.isReading = true;
		this.ttsEngine.reset();

		try {
			if (this.settings.showNotices) {
				new Notice(`开始朗读: ${title}`, 2000);
			}

			const format = getAudioFormat(
				this.settings.activeProvider,
				this.settings.zhipu.responseFormat
			);

			const buffers = await this.ttsEngine.synthesizeAll(text, (progress) => {
				this.playbackManager.updateProgressFromEngine(progress);
				if (!this.settings.disableFloatingPlayer) {
					this.floatingPlayer.update({
						isPlaying: progress.status !== "stopped",
						isPaused: false,
						currentSegment: progress.current,
						totalSegments: progress.total,
						title,
						currentTime: 0,
						duration: 0,
					});
				}
			});

			if (buffers.length === 0) {
				throw new Error("未生成音频");
			}

			await this.playbackManager.playBuffers(
				buffers,
				title,
				this.settings.playbackSpeed,
				format
			);
		} catch (err) {
			new Notice(`朗读失败: ${formatError(err)}`, 8000);
			this.isReading = false;
		}
	}

	private stopReading() {
		this.ttsEngine.stop();
		this.playbackManager.stop();
		this.isReading = false;
		this.currentQueueItemId = null;
		this.queuePanel.setHighlightId(null);
		this.updateStatusBar(false);
	}

	private async playNextInQueue() {
		this.isReading = false;
		if (!this.settings.enableQueueFeature) return;

		const next = this.queueManager.shift();
		if (next) {
			this.currentQueueItemId = next.id;
			this.queuePanel.setHighlightId(next.id);
			await this.readText(next.text, next.title, true);
		} else {
			this.currentQueueItemId = null;
			this.queuePanel.setHighlightId(null);
		}
	}

	private async generateMp3(
		editor: Editor,
		view: MarkdownView,
		textOverride?: string
	) {
		const text = textOverride ?? editor.getValue();
		const title = getNoteTitle(view.file);
		await this.exportMp3FromText(text, title, editor);
	}

	private async exportMp3FromText(
		text: string,
		title: string,
		editor: Editor | null
	) {
		if (!isDesktopExportAvailable()) {
			new Notice("MP3 导出仅在桌面版可用");
			return;
		}

		try {
			if (this.settings.showNotices) {
				new Notice("正在生成 MP3...", 2000);
			}

			const buffers = await this.ttsEngine.synthesizeAll(text);
			const fileName = sanitizeFileName(title);
			const path = await exportMp3ToVault(
				this.app,
				buffers,
				fileName,
				this.settings.mp3Export.outputFolder
			);

			if (this.settings.mp3Export.embedInNote && editor) {
				await embedMp3InNote(editor, path);
			}

			if (this.settings.showNotices) {
				new Notice(`MP3 已导出: ${path}`, 5000);
			}
		} catch (err) {
			new Notice(`MP3 导出失败: ${formatError(err)}`, 8000);
		}
	}

	private updateStatusBar(active: boolean) {
		if (!this.statusBarItem) return;
		this.statusBarItem.toggleClass("obsidian-tts-active", active);
	}
}
