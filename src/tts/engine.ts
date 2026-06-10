import { Notice } from "obsidian";
import type { ObsidianTtsSettings } from "../settings/types";
import { preprocessText } from "../text/preprocessor";
import { formatError, logError, logInfo } from "../utils/logger";
import { chunkText } from "./chunker";
import { ProviderRegistry } from "./registry";
import { SynthesisOptions, concatArrayBuffers } from "./provider";

export interface SynthesisProgress {
	current: number;
	total: number;
	status: "synthesizing" | "playing" | "done" | "error" | "stopped";
	message?: string;
}

export type ProgressCallback = (progress: SynthesisProgress) => void;

export class TTSEngine {
	private registry: ProviderRegistry;
	private settings: ObsidianTtsSettings;
	private aborted = false;

	constructor(settings: ObsidianTtsSettings) {
		this.settings = settings;
		this.registry = new ProviderRegistry(settings);
	}

	updateSettings(settings: ObsidianTtsSettings): void {
		this.settings = settings;
		this.registry.updateSettings(settings);
	}

	stop(): void {
		this.aborted = true;
	}

	reset(): void {
		this.aborted = false;
	}

	prepareText(rawText: string): string {
		return preprocessText(rawText, this.settings.textFiltering);
	}

	async synthesizeAll(
		rawText: string,
		onProgress?: ProgressCallback,
		onChunkReady?: (buffer: ArrayBuffer) => void
	): Promise<ArrayBuffer[]> {
		this.aborted = false;
		const text = this.prepareText(rawText);
		if (!text.trim()) {
			throw new Error("过滤后没有可朗读的内容");
		}

		const provider = this.registry.getActiveProvider();
		const chunks = chunkText(text, provider.getMaxChunkSize());

		logInfo("[engine] 开始合成", {
			provider: provider.id,
			chunks: chunks.length,
			textLength: text.length,
			rate: this.settings.playbackSpeed,
		});

		if (this.settings.showNotices && chunks.length > 1) {
			new Notice(`长文本已分为 ${chunks.length} 段进行合成`, 3000);
		}

		const options = this.buildSynthesisOptions();
		const buffers: ArrayBuffer[] = [];

		for (let i = 0; i < chunks.length; i++) {
			if (this.aborted) {
				onProgress?.({
					current: i,
					total: chunks.length,
					status: "stopped",
				});
				break;
			}

			onProgress?.({
				current: i + 1,
				total: chunks.length,
				status: "synthesizing",
				message: `正在合成 ${i + 1}/${chunks.length}`,
			});

			try {
				const buffer = await provider.synthesize(chunks[i], options);
				buffers.push(buffer);
				onChunkReady?.(buffer);
				logInfo(`[engine] 段 ${i + 1}/${chunks.length} 完成`, {
					bytes: buffer.byteLength,
				});
			} catch (err) {
				const msg = formatError(err);
				logError(`[engine] 段 ${i + 1}/${chunks.length} 失败`, err);
				onProgress?.({
					current: i + 1,
					total: chunks.length,
					status: "error",
					message: msg,
				});
				throw err;
			}
		}

		onProgress?.({
			current: chunks.length,
			total: chunks.length,
			status: "done",
		});

		logInfo("[engine] 合成完成", {
			provider: provider.id,
			segments: buffers.length,
			totalBytes: buffers.reduce((n, b) => n + b.byteLength, 0),
		});

		return buffers;
	}

	async synthesizeMerged(rawText: string, onProgress?: ProgressCallback): Promise<ArrayBuffer> {
		const buffers = await this.synthesizeAll(rawText, onProgress);
		if (buffers.length === 0) {
			throw new Error("未生成任何音频");
		}
		return concatArrayBuffers(buffers);
	}

	private buildSynthesisOptions(): SynthesisOptions {
		const s = this.settings;
		let voice = s.edge.voice;

		switch (s.activeProvider) {
			case "openai":
				voice = s.openai.voice;
				break;
			case "openai-compatible":
				voice = s.openaiCompatible.voice;
				break;
			case "azure":
				voice = s.azure.voice;
				break;
			case "google":
				voice = s.google.voiceName;
				break;
			case "elevenlabs":
				voice = s.elevenlabs.voiceId;
				break;
			case "zhipu":
				voice = s.zhipu.voice;
				break;
			case "aliyun":
				voice = s.aliyun.voice;
				break;
		}

		return {
			voice,
			rate: s.playbackSpeed,
		};
	}
}
