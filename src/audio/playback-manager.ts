import { detectAudioFormat } from "./wav";
import { MseAudioPlayer } from "./mse-player";
import { getMimeType } from "../tts/provider";
import type { SynthesisProgress } from "../tts/engine";
import { logError, logInfo } from "../utils/logger";

export interface PlaybackState {
	isPlaying: boolean;
	isPaused: boolean;
	currentSegment: number;
	totalSegments: number;
	title: string;
	currentTime: number;
	duration: number;
	canTogglePause: boolean;
	canStop: boolean;
	canSeek: boolean;
	/** 合成进度 0–100，播放开始后仍为 100 */
	synthesisPercent: number;
	/** 是否正在合成音频 */
	isSynthesizing: boolean;
	synthesisMessage?: string;
}

export function buildPlaybackState(
	fields: Omit<
		PlaybackState,
		"canTogglePause" | "canStop" | "canSeek" | "synthesisPercent" | "isSynthesizing"
	> &
		Partial<Pick<PlaybackState, "synthesisPercent" | "isSynthesizing" | "synthesisMessage">>
): PlaybackState {
	const {
		synthesisPercent = 0,
		isSynthesizing = false,
		synthesisMessage,
		...rest
	} = fields;
	const canSeek = rest.duration > 0 && Number.isFinite(rest.duration);
	const hasActiveSession =
		rest.totalSegments > 0 &&
		(rest.isPlaying || rest.isPaused || rest.duration > 0);
	return {
		...rest,
		synthesisPercent,
		isSynthesizing,
		synthesisMessage,
		canTogglePause: hasActiveSession,
		canStop: hasActiveSession,
		canSeek,
	};
}

type StateCallback = (state: PlaybackState) => void;

export class PlaybackManager {
	private audio: HTMLAudioElement | null = null;
	private blobUrl: string | null = null;
	private preloadedUrl: string | null = null;
	private buffers: ArrayBuffer[] = [];
	private currentIndex = 0;
	private playbackRate = 1.0;
	private title = "";
	private stateCallback: StateCallback | null = null;
	private onCompleteCallback: (() => void) | null = null;
	private stopped = false;
	private timeupdateHandler: (() => void) | null = null;
	private streaming = false;
	private streamingFormat: "mp3" | "wav" = "mp3";
	private paused = false;
	private msePlayer: MseAudioPlayer | null = null;
	private mseMode = false;
	private mseStarted = false;
	private synthesisPercent = 0;
	private isSynthesizing = false;
	private synthesisMessage: string | undefined;

	setStateCallback(cb: StateCallback): void {
		this.stateCallback = cb;
	}

	setOnComplete(cb: () => void): void {
		this.onCompleteCallback = cb;
	}

	async playBuffers(
		buffers: ArrayBuffer[],
		title: string,
		rate: number,
		format: "mp3" | "wav" = "mp3"
	): Promise<void> {
		this.stopInternal(false);
		this.buffers = buffers;
		this.currentIndex = 0;
		this.playbackRate = rate;
		this.title = title;
		this.stopped = false;
		await this.playCurrent(format);
	}

	prepareStreaming(title: string, rate: number, format: "mp3" | "wav" = "mp3"): void {
		this.stopInternal(false);
		this.buffers = [];
		this.currentIndex = 0;
		this.playbackRate = rate;
		this.title = title;
		this.stopped = false;
		this.streaming = true;
		this.streamingFormat = format;
		this.mseMode = false;
		this.synthesisPercent = 0;
		this.isSynthesizing = true;
		this.synthesisMessage = undefined;
	}

	async prepareMseStreaming(
		title: string,
		rate: number,
		format: "mp3" | "wav" = "mp3"
	): Promise<boolean> {
		this.stopInternal(false);
		this.buffers = [];
		this.currentIndex = 0;
		this.playbackRate = rate;
		this.title = title;
		this.stopped = false;
		this.streaming = true;
		this.streamingFormat = format;
		this.mseMode = true;
		this.mseStarted = false;
		this.synthesisPercent = 0;
		this.isSynthesizing = true;
		this.synthesisMessage = undefined;

		try {
			const mime = getMimeType(format);
			this.msePlayer = new MseAudioPlayer(mime);
			this.audio = await this.msePlayer.start(rate);

			this.timeupdateHandler = () => {
				this.emitState(!this.paused, this.paused);
			};
			this.audio.addEventListener("timeupdate", this.timeupdateHandler);

			this.audio.onended = () => {
				if (!this.streaming) {
					this.emitState(false, false);
					this.onCompleteCallback?.();
				}
			};

			logInfo("[playback] MSE 流式模式已启用");
			return true;
		} catch (err) {
			logError("[playback] MSE 初始化失败，回退普通模式", err);
			this.mseMode = false;
			this.msePlayer?.destroy();
			this.msePlayer = null;
			this.prepareStreaming(title, rate, format);
			return false;
		}
	}

	appendStreamChunk(chunk: Uint8Array): void {
		if (!this.mseMode || !this.msePlayer) return;

		this.msePlayer.append(chunk);

		if (!this.mseStarted && !this.paused && !this.stopped) {
			this.mseStarted = true;
			this.emitState(true, false);
			void this.msePlayer.play().catch((err) => {
				logError("[playback] MSE 播放失败", err);
			});
		}
	}

	appendBuffer(buffer: ArrayBuffer): void {
		if (this.mseMode) {
			this.buffers.push(buffer);
			return;
		}

		if (this.streaming && this.buffers.length === 0) {
			const detected = detectAudioFormat(buffer);
			if (detected !== this.streamingFormat) {
				this.streamingFormat = detected;
			}
		}
		this.buffers.push(buffer);
		this.preloadNextSegment();
		if (!this.audio && !this.paused) {
			void this.playCurrent(this.streamingFormat);
		}
	}

	finishStreaming(): void {
		this.streaming = false;
		this.isSynthesizing = false;
		this.synthesisPercent = 100;
		this.synthesisMessage = undefined;
		if (this.mseMode && this.msePlayer) {
			this.msePlayer.finish();
		}
		this.checkStreamingCompletion();
	}

	private preloadNextSegment(): void {
		if (this.preloadedUrl) {
			URL.revokeObjectURL(this.preloadedUrl);
			this.preloadedUrl = null;
		}
		const nextIndex = this.currentIndex + 1;
		if (nextIndex < this.buffers.length) {
			const mime = getMimeType(this.streamingFormat);
			const blob = new Blob([this.buffers[nextIndex]], { type: mime });
			this.preloadedUrl = URL.createObjectURL(blob);
		}
	}

	private async playCurrent(format: "mp3" | "wav"): Promise<void> {
		if (this.stopped) {
			this.emitState(false, false);
			this.onCompleteCallback?.();
			return;
		}

		if (this.currentIndex >= this.buffers.length) {
			if (this.streaming) {
				return;
			}
			this.emitState(false, false);
			this.onCompleteCallback?.();
			return;
		}

		this.cleanupAudio(false);
		const mime = getMimeType(format);

		if (this.preloadedUrl && this.currentIndex > 0) {
			this.blobUrl = this.preloadedUrl;
			this.preloadedUrl = null;
		} else {
			const blob = new Blob([this.buffers[this.currentIndex]], { type: mime });
			this.blobUrl = URL.createObjectURL(blob);
		}

		this.audio = new Audio(this.blobUrl);
		this.audio.playbackRate = this.playbackRate;

		this.timeupdateHandler = () => {
			this.emitState(!this.paused, this.paused);
		};
		this.audio.addEventListener("timeupdate", this.timeupdateHandler);

		this.audio.onended = () => {
			this.currentIndex++;
			this.preloadNextSegment();
			void this.playCurrent(format);
		};

		this.audio.onerror = () => {
			this.currentIndex++;
			void this.playCurrent(format);
		};

		this.preloadNextSegment();

		if (this.paused) {
			this.emitState(false, true);
		} else {
			this.emitState(true, false);
			await this.audio.play();
		}
	}

	pause(): void {
		if (this.paused) return;
		this.paused = true;
		if (this.audio) {
			this.audio.pause();
		}
		this.emitState(false, true);
	}

	resume(): void {
		if (!this.paused) return;
		this.paused = false;
		if (this.audio) {
			void this.audio.play();
			this.emitState(true, false);
		} else if (this.mseMode && this.msePlayer && this.mseStarted) {
			void this.msePlayer.play();
			this.emitState(true, false);
		} else if (this.streaming && this.currentIndex < this.buffers.length) {
			void this.playCurrent(this.streamingFormat);
		} else if (this.streaming) {
			this.emitState(false, true);
		}
	}

	stop(): void {
		this.stopInternal(true);
	}

	private stopInternal(notifyComplete: boolean): void {
		this.stopped = true;
		this.streaming = false;
		this.paused = false;
		this.mseMode = false;
		this.mseStarted = false;
		this.isSynthesizing = false;
		this.synthesisPercent = 0;
		this.synthesisMessage = undefined;
		this.cleanupAudio(true);
		this.buffers = [];
		this.currentIndex = 0;
		this.emitState(false, false);
		if (notifyComplete) {
			this.onCompleteCallback?.();
		}
	}

	togglePause(): void {
		if (this.paused) {
			this.resume();
		} else {
			this.pause();
		}
	}

	isPaused(): boolean {
		return this.paused;
	}

	isActive(): boolean {
		return (this.buffers.length > 0 || this.mseMode) && !this.stopped;
	}

	getCollectedBuffers(): ArrayBuffer[] {
		return [...this.buffers];
	}

	getCurrentTime(): number {
		return this.audio?.currentTime ?? 0;
	}

	getDuration(): number {
		return this.audio?.duration ?? 0;
	}

	seek(time: number): void {
		if (this.audio) {
			this.audio.currentTime = time;
		}
	}

	jumpForward(seconds = 10): void {
		if (this.audio) {
			const target = Math.min(
				this.audio.currentTime + seconds,
				this.audio.duration
			);
			this.audio.currentTime = target;
		}
	}

	jumpBackward(seconds = 10): void {
		if (this.audio) {
			const target = Math.max(this.audio.currentTime - seconds, 0);
			this.audio.currentTime = target;
		}
	}

	private cleanupAudio(includeMse: boolean): void {
		if (this.audio) {
			if (this.timeupdateHandler) {
				this.audio.removeEventListener(
					"timeupdate",
					this.timeupdateHandler
				);
				this.timeupdateHandler = null;
			}
			this.audio.onended = null;
			this.audio.onerror = null;
			this.audio.pause();
			this.audio = null;
		}
		if (this.blobUrl) {
			URL.revokeObjectURL(this.blobUrl);
			this.blobUrl = null;
		}
		if (this.preloadedUrl) {
			URL.revokeObjectURL(this.preloadedUrl);
			this.preloadedUrl = null;
		}
		if (includeMse && this.msePlayer) {
			this.msePlayer.destroy();
			this.msePlayer = null;
		}
	}

	private emitState(isPlaying: boolean, _isPaused?: boolean): void {
		this.stateCallback?.(
			buildPlaybackState({
				isPlaying,
				isPaused: this.paused,
				currentSegment: this.currentIndex + 1,
				totalSegments: this.buffers.length,
				title: this.title,
				currentTime: this.audio?.currentTime ?? 0,
				duration: this.audio?.duration ?? 0,
				synthesisPercent: this.synthesisPercent,
				isSynthesizing: this.isSynthesizing,
				synthesisMessage: this.synthesisMessage,
			})
		);
	}

	updateProgressFromEngine(progress: SynthesisProgress): void {
		this.isSynthesizing = progress.status === "synthesizing";
		this.synthesisPercent = progress.percent;
		this.synthesisMessage = progress.message;
		this.stateCallback?.(
			buildPlaybackState({
				isPlaying:
					progress.status === "playing" ||
					(progress.status === "synthesizing" && this.mseStarted),
				isPaused: this.paused,
				currentSegment: progress.current,
				totalSegments: progress.total,
				title: this.title,
				currentTime: this.audio?.currentTime ?? 0,
				duration: this.audio?.duration ?? 0,
				synthesisPercent: progress.percent,
				isSynthesizing: progress.status === "synthesizing",
				synthesisMessage: progress.message,
			})
		);
	}

	private checkStreamingCompletion(): void {
		if (this.mseMode) {
			return;
		}
		if (!this.streaming && this.currentIndex >= this.buffers.length && !this.audio) {
			this.emitState(false, false);
			this.onCompleteCallback?.();
		}
	}
}
