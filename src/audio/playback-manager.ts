import { getMimeType } from "../tts/provider";
import type { SynthesisProgress } from "../tts/engine";

export interface PlaybackState {
	isPlaying: boolean;
	isPaused: boolean;
	currentSegment: number;
	totalSegments: number;
	title: string;
	currentTime: number;
	duration: number;
}

type StateCallback = (state: PlaybackState) => void;

export class PlaybackManager {
	private audio: HTMLAudioElement | null = null;
	private blobUrl: string | null = null;
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
	}

	appendBuffer(buffer: ArrayBuffer): void {
		this.buffers.push(buffer);
		if (!this.audio && !this.paused) {
			void this.playCurrent(this.streamingFormat);
		}
	}

	finishStreaming(): void {
		this.streaming = false;
		this.checkStreamingCompletion();
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

		this.cleanupAudio();
		const mime = getMimeType(format);
		const blob = new Blob([this.buffers[this.currentIndex]], { type: mime });
		this.blobUrl = URL.createObjectURL(blob);
		this.audio = new Audio(this.blobUrl);
		this.audio.playbackRate = this.playbackRate;

		this.timeupdateHandler = () => {
			this.emitState(true, false);
		};
		this.audio.addEventListener("timeupdate", this.timeupdateHandler);

		this.audio.onended = () => {
			this.currentIndex++;
			void this.playCurrent(format);
		};

		this.audio.onerror = () => {
			this.currentIndex++;
			void this.playCurrent(format);
		};

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
		this.cleanupAudio();
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

	isActive(): boolean {
		return this.buffers.length > 0 && !this.stopped;
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

	private cleanupAudio(): void {
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
	}

	private emitState(isPlaying: boolean, isPaused: boolean): void {
		this.stateCallback?.({
			isPlaying,
			isPaused,
			currentSegment: this.currentIndex + 1,
			totalSegments: this.buffers.length,
			title: this.title,
			currentTime: this.audio?.currentTime ?? 0,
			duration: this.audio?.duration ?? 0,
		});
	}

	updateProgressFromEngine(progress: SynthesisProgress): void {
		this.stateCallback?.({
			isPlaying: progress.status === "playing",
			isPaused: this.paused,
			currentSegment: progress.current,
			totalSegments: progress.total,
			title: this.title,
			currentTime: 0,
			duration: 0,
		});
	}

	private checkStreamingCompletion(): void {
		if (!this.streaming && this.currentIndex >= this.buffers.length && !this.audio) {
			this.emitState(false, false);
			this.onCompleteCallback?.();
		}
	}
}
