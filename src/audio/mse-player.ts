import { logInfo, logError } from "../utils/logger";

export class MseAudioPlayer {
	private mediaSource: MediaSource | null = null;
	private sourceBuffer: SourceBuffer | null = null;
	private audio: HTMLAudioElement | null = null;
	private blobUrl: string | null = null;
	private pending: Uint8Array[] = [];
	private ready = false;
	private finished = false;
	private mimeType: string;

	constructor(mimeType = "audio/mpeg") {
		this.mimeType = mimeType;
	}

	getAudioElement(): HTMLAudioElement | null {
		return this.audio;
	}

	async start(playbackRate: number): Promise<HTMLAudioElement> {
		if (!window.MediaSource) {
			throw new Error("MediaSource 不可用");
		}

		this.mediaSource = new MediaSource();
		this.blobUrl = URL.createObjectURL(this.mediaSource);
		this.audio = new Audio(this.blobUrl);
		this.audio.playbackRate = playbackRate;

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("MediaSource 打开超时"));
			}, 5000);

			this.mediaSource!.addEventListener(
				"sourceopen",
				() => {
					clearTimeout(timeout);
					try {
						this.sourceBuffer = this.mediaSource!.addSourceBuffer(
							this.mimeType
						);
						this.sourceBuffer.mode = "sequence";
						this.sourceBuffer.addEventListener("updateend", () => {
							this.flushPending();
						});
						this.ready = true;
						this.flushPending();
						resolve();
					} catch (err) {
						reject(err);
					}
				},
				{ once: true }
			);
		});

		logInfo("[mse] 流式播放器已启动", { mimeType: this.mimeType });
		return this.audio;
	}

	append(data: Uint8Array): void {
		if (data.byteLength === 0) return;
		this.pending.push(data);
		this.flushPending();
	}

	private flushPending(): void {
		if (!this.ready || !this.sourceBuffer || this.sourceBuffer.updating) {
			return;
		}
		if (this.pending.length === 0) {
			if (this.finished && this.mediaSource?.readyState === "open") {
				try {
					this.mediaSource.endOfStream();
				} catch {
					// already ended
				}
			}
			return;
		}
		const chunk = this.pending.shift()!;
		try {
			this.sourceBuffer.appendBuffer(chunk.buffer.slice(
				chunk.byteOffset,
				chunk.byteOffset + chunk.byteLength
			) as ArrayBuffer);
		} catch (err) {
			logError("[mse] appendBuffer 失败", err);
		}
	}

	async play(): Promise<void> {
		if (this.audio) {
			await this.audio.play();
		}
	}

	finish(): void {
		this.finished = true;
		this.flushPending();
	}

	destroy(): void {
		this.finished = true;
		this.pending = [];
		if (this.audio) {
			this.audio.pause();
			this.audio.src = "";
			this.audio = null;
		}
		if (this.blobUrl) {
			URL.revokeObjectURL(this.blobUrl);
			this.blobUrl = null;
		}
		if (this.mediaSource && this.mediaSource.readyState === "open") {
			try {
				this.mediaSource.endOfStream();
			} catch {
				// ignore
			}
		}
		this.mediaSource = null;
		this.sourceBuffer = null;
		this.ready = false;
	}
}
