import { Notice, Platform } from "obsidian";
import type { ObsidianTtsSettings } from "../settings/types";
import { preprocessText } from "../text/preprocessor";
import { formatError, logError, logInfo } from "../utils/logger";
import { buildCacheKey, TTSCache } from "./cache";
import { chunkTextWithFastStart } from "./chunker";
import { ProviderRegistry } from "./registry";
import { SynthesisOptions, TTSProvider, concatArrayBuffers } from "./provider";

export interface SynthesisProgress {
	current: number;
	total: number;
	status: "synthesizing" | "playing" | "done" | "error" | "stopped";
	message?: string;
	/** 已处理字符数 */
	processedChars: number;
	/** 总字符数 */
	totalChars: number;
	/** 0–100 */
	percent: number;
}

export type ProgressCallback = (progress: SynthesisProgress) => void;
export type ChunkReadyCallback = (buffer: ArrayBuffer, index: number) => void;
export type StreamChunkCallback = (chunk: Uint8Array) => void;

export interface SynthesizeAllOptions {
	/** 并行合成并发数，1 为串行 */
	concurrency?: number;
	/** 首段使用较小分块以更快开始播放 */
	fastStart?: boolean;
	/** 是否使用缓存 */
	useCache?: boolean;
	/** Edge 直连时启用段内流式回调 */
	onStreamChunk?: StreamChunkCallback;
}

function totalCharCount(chunks: string[]): number {
	return chunks.reduce((sum, c) => sum + c.length, 0);
}

function buildProgress(
	chunks: string[],
	completedCount: number,
	current: number,
	total: number,
	status: SynthesisProgress["status"],
	message?: string
): SynthesisProgress {
	const totalChars = totalCharCount(chunks);
	let processedChars = 0;
	for (let i = 0; i < completedCount && i < chunks.length; i++) {
		processedChars += chunks[i].length;
	}
	const percent =
		totalChars > 0
			? Math.min(100, Math.round((processedChars / totalChars) * 100))
			: total > 0
				? Math.min(100, Math.round((current / total) * 100))
				: status === "done"
					? 100
					: 0;

	return {
		current,
		total,
		status,
		message,
		processedChars,
		totalChars,
		percent,
	};
}

export class TTSEngine {
	private registry: ProviderRegistry;
	private settings: ObsidianTtsSettings;
	private cache: TTSCache;
	private aborted = false;

	constructor(settings: ObsidianTtsSettings) {
		this.settings = settings;
		this.registry = new ProviderRegistry(settings);
		this.cache = new TTSCache(settings.enableAudioCache);
	}

	updateSettings(settings: ObsidianTtsSettings): void {
		this.settings = settings;
		this.registry.updateSettings(settings);
		this.cache.setEnabled(settings.enableAudioCache);
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

	canUseEdgeStreaming(): boolean {
		const s = this.settings;
		return (
			s.activeProvider === "edge" &&
			!Platform.isMobile &&
			(s.edge.connectionMode === "direct" || s.edge.connectionMode === "auto")
		);
	}

	async synthesizeAll(
		rawText: string,
		onProgress?: ProgressCallback,
		onChunkReady?: ChunkReadyCallback,
		opts?: SynthesizeAllOptions
	): Promise<ArrayBuffer[]> {
		this.aborted = false;
		const text = this.prepareText(rawText);
		if (!text.trim()) {
			throw new Error("过滤后没有可朗读的内容");
		}

		const provider = this.registry.getActiveProvider();
		const fastStart = opts?.fastStart ?? true;
		const chunks = chunkTextWithFastStart(
			text,
			provider.getMaxChunkSize(),
			fastStart
		);

		const concurrency = Math.max(
			1,
			opts?.concurrency ?? this.settings.synthesisConcurrency
		);
		const useCache = opts?.useCache ?? this.settings.enableAudioCache;
		const options = this.buildSynthesisOptions(opts?.onStreamChunk);

		logInfo("[engine] 开始合成", {
			provider: provider.id,
			chunks: chunks.length,
			textLength: text.length,
			rate: this.settings.playbackSpeed,
			concurrency,
			fastStart,
			useCache,
			streaming: !!opts?.onStreamChunk,
		});

		if (this.settings.showNotices && chunks.length > 1) {
			new Notice(`长文本已分为 ${chunks.length} 段进行合成`, 3000);
		}

		onProgress?.(
			buildProgress(chunks, 0, 0, chunks.length, "synthesizing", "准备合成…")
		);

		if (concurrency <= 1) {
			return this.synthesizeSequential(
				chunks,
				provider,
				options,
				useCache,
				onProgress,
				onChunkReady
			);
		}

		return this.synthesizeParallel(
			chunks,
			provider,
			options,
			useCache,
			concurrency,
			onProgress,
			onChunkReady
		);
	}

	private async synthesizeSequential(
		chunks: string[],
		provider: TTSProvider,
		options: SynthesisOptions,
		useCache: boolean,
		onProgress?: ProgressCallback,
		onChunkReady?: ChunkReadyCallback
	): Promise<ArrayBuffer[]> {
		const buffers: ArrayBuffer[] = [];

		for (let i = 0; i < chunks.length; i++) {
			if (this.aborted) {
				onProgress?.(
					buildProgress(chunks, i, i, chunks.length, "stopped")
				);
				break;
			}

			onProgress?.(
				buildProgress(
					chunks,
					i,
					i + 1,
					chunks.length,
					"synthesizing",
					`正在合成 ${i + 1}/${chunks.length}`
				)
			);

			try {
				const buffer = await this.synthesizeOneChunk(
					chunks[i],
					options,
					provider,
					useCache
				);
				buffers.push(buffer);
				onChunkReady?.(buffer, i);
				onProgress?.(
					buildProgress(
						chunks,
						i + 1,
						i + 1,
						chunks.length,
						i + 1 < chunks.length ? "synthesizing" : "done",
						i + 1 < chunks.length
							? `已完成 ${i + 1}/${chunks.length} 段`
							: "合成完成"
					)
				);
				logInfo(`[engine] 段 ${i + 1}/${chunks.length} 完成`, {
					bytes: buffer.byteLength,
				});
			} catch (err) {
				const msg = formatError(err);
				logError(`[engine] 段 ${i + 1}/${chunks.length} 失败`, err);
				onProgress?.(
					buildProgress(chunks, i, i + 1, chunks.length, "error", msg)
				);
				throw err;
			}
		}

		if (!this.aborted) {
			onProgress?.(
				buildProgress(chunks, chunks.length, chunks.length, chunks.length, "done")
			);
		}

		logInfo("[engine] 合成完成", {
			provider: provider.id,
			segments: buffers.length,
			totalBytes: buffers.reduce((n, b) => n + b.byteLength, 0),
		});

		return buffers;
	}

	private async synthesizeParallel(
		chunks: string[],
		provider: TTSProvider,
		options: SynthesisOptions,
		useCache: boolean,
		concurrency: number,
		onProgress?: ProgressCallback,
		onChunkReady?: ChunkReadyCallback
	): Promise<ArrayBuffer[]> {
		const results: (ArrayBuffer | undefined)[] = new Array(chunks.length);
		const completedIndices = new Set<number>();
		let nextEmit = 0;
		let nextIndex = 0;
		let active = 0;
		let failed: Error | null = null;

		const reportParallelProgress = (
			status: SynthesisProgress["status"],
			message?: string
		) => {
			let processedChars = 0;
			for (const idx of completedIndices) {
				processedChars += chunks[idx].length;
			}
			const completedCount = completedIndices.size;
			onProgress?.({
				...buildProgress(
					chunks,
					completedCount,
					completedCount,
					chunks.length,
					status,
					message
				),
				processedChars,
				percent:
					totalCharCount(chunks) > 0
						? Math.min(
								100,
								Math.round(
									(processedChars / totalCharCount(chunks)) * 100
								)
							)
						: chunks.length > 0
							? Math.round((completedCount / chunks.length) * 100)
							: 0,
			});
		};

		const tryEmit = () => {
			while (nextEmit < chunks.length && results[nextEmit] !== undefined) {
				onChunkReady?.(results[nextEmit]!, nextEmit);
				nextEmit++;
			}
		};

		await new Promise<void>((resolve, reject) => {
			const startNext = () => {
				if (failed || this.aborted) {
					if (active === 0) {
						if (failed) reject(failed);
						else resolve();
					}
					return;
				}

				while (active < concurrency && nextIndex < chunks.length) {
					const i = nextIndex++;
					active++;

					reportParallelProgress(
						"synthesizing",
						`正在合成 ${i + 1}/${chunks.length}`
					);

					this.synthesizeOneChunk(chunks[i], options, provider, useCache)
						.then((buffer) => {
							results[i] = buffer;
							completedIndices.add(i);
							active--;
							tryEmit();
							reportParallelProgress(
								nextIndex >= chunks.length && active === 0
									? "done"
									: "synthesizing",
								`已完成 ${completedIndices.size}/${chunks.length} 段`
							);
							logInfo(`[engine] 段 ${i + 1}/${chunks.length} 完成`, {
								bytes: buffer.byteLength,
							});
							if (nextIndex >= chunks.length && active === 0) {
								resolve();
							} else {
								startNext();
							}
						})
						.catch((err) => {
							failed = err instanceof Error ? err : new Error(formatError(err));
							logError(`[engine] 段 ${i + 1}/${chunks.length} 失败`, err);
							reportParallelProgress("error", formatError(err));
							active--;
							if (active === 0) reject(failed);
						});
				}
			};

			if (chunks.length === 0) {
				resolve();
				return;
			}
			startNext();
		});

		const buffers = results.filter((b): b is ArrayBuffer => b !== undefined);

		logInfo("[engine] 并行合成完成", {
			provider: provider.id,
			segments: buffers.length,
			totalBytes: buffers.reduce((n, b) => n + b.byteLength, 0),
		});

		return buffers;
	}

	private async synthesizeOneChunk(
		text: string,
		options: SynthesisOptions,
		provider: TTSProvider,
		useCache: boolean
	): Promise<ArrayBuffer> {
		if (useCache) {
			const key = await buildCacheKey(
				provider.id,
				options.voice,
				options.rate,
				text
			);
			const cached = await this.cache.get(key);
			if (cached) {
				logInfo("[engine] 缓存命中", { provider: provider.id, bytes: cached.byteLength });
				return cached;
			}

			const buffer = await provider.synthesize(text, options);
			await this.cache.set(key, buffer);
			return buffer;
		}

		return provider.synthesize(text, options);
	}

	async synthesizeMerged(rawText: string, onProgress?: ProgressCallback): Promise<ArrayBuffer> {
		const buffers = await this.synthesizeAll(rawText, onProgress, undefined, {
			concurrency: this.settings.exportConcurrency,
			fastStart: false,
			useCache: this.settings.enableAudioCache,
		});
		if (buffers.length === 0) {
			throw new Error("未生成任何音频");
		}
		return concatArrayBuffers(buffers);
	}

	private buildSynthesisOptions(
		onStreamChunk?: StreamChunkCallback
	): SynthesisOptions {
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
			onStreamChunk,
		};
	}
}
