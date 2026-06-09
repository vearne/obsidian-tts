import { getMimeType } from "../tts/provider";
import type { SynthesisProgress } from "../tts/engine";

export interface PlaybackState {
	isPlaying: boolean;
	isPaused: boolean;
	currentSegment: number;
	totalSegments: number;
	title: string;
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

	private async playCurrent(format: "mp3" | "wav"): Promise<void> {
		if (this.stopped || this.currentIndex >= this.buffers.length) {
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

		this.audio.onended = () => {
			this.currentIndex++;
			void this.playCurrent(format);
		};

		this.audio.onerror = () => {
			this.currentIndex++;
			void this.playCurrent(format);
		};

		this.emitState(true, false);
		await this.audio.play();
	}

	pause(): void {
		if (this.audio && !this.audio.paused) {
			this.audio.pause();
			this.emitState(false, true);
		}
	}

	resume(): void {
		if (this.audio && this.audio.paused) {
			void this.audio.play();
			this.emitState(true, false);
		}
	}

	stop(): void {
		this.stopInternal(true);
	}

	private stopInternal(notifyComplete: boolean): void {
		this.stopped = true;
		this.cleanupAudio();
		this.buffers = [];
		this.currentIndex = 0;
		this.emitState(false, false);
		if (notifyComplete) {
			this.onCompleteCallback?.();
		}
	}

	togglePause(): void {
		if (!this.audio) return;
		if (this.audio.paused) {
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

	private cleanupAudio(): void {
		if (this.audio) {
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
		});
	}

	updateProgressFromEngine(progress: SynthesisProgress): void {
		this.stateCallback?.({
			isPlaying: progress.status === "playing",
			isPaused: false,
			currentSegment: progress.current,
			totalSegments: progress.total,
			title: this.title,
		});
	}
}
