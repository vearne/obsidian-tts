import { setIcon } from "obsidian";
import type { PlaybackState } from "../audio/playback-manager";

export class FloatingPlayer {
	private container: HTMLElement | null = null;
	private onPause: () => void;
	private onStop: () => void;
	private onSeek: (time: number) => void;
	private onJumpForward: () => void;
	private onJumpBackward: () => void;
	private savedPosition: { x: number; y: number } | null = null;
	private dragging = false;
	private dragOffset = { x: 0, y: 0 };
	private seekDragging = false;

	constructor(
		onPause: () => void,
		onStop: () => void,
		savedPosition: { x: number; y: number } | null,
		onSeek: (time: number) => void,
		onJumpForward: () => void,
		onJumpBackward: () => void
	) {
		this.onPause = onPause;
		this.onStop = onStop;
		this.savedPosition = savedPosition;
		this.onSeek = onSeek;
		this.onJumpForward = onJumpForward;
		this.onJumpBackward = onJumpBackward;
	}

	show(state: PlaybackState): void {
		if (!this.container) {
			this.create();
		}
		this.update(state);
		if (this.container) {
			this.container.style.display = "flex";
		}
	}

	hide(): void {
		if (this.container) {
			this.container.style.display = "none";
		}
	}

	update(state: PlaybackState): void {
		if (!this.container) return;
		const titleEl = this.container.querySelector(".obsidian-tts-player-title");
		const progressEl = this.container.querySelector(
			".obsidian-tts-player-progress"
		);
		const pauseIcon = this.container.querySelector(
			".obsidian-tts-player-pause-icon"
		);
		const seekRow = this.container.querySelector(
			".obsidian-tts-player-seek-row"
		);
		const seekSlider = this.container.querySelector(
			".obsidian-tts-player-seek"
		) as HTMLInputElement | null;
		const timeDisplay = this.container.querySelector(
			".obsidian-tts-player-time"
		);

		if (titleEl) titleEl.textContent = state.title || "朗读中";

		if (state.duration > 0 && seekRow) {
			seekRow.setAttribute("style", "display: flex;");
			if (progressEl) {
				(progressEl as HTMLElement).style.display = "none";
			}

			if (seekSlider && !this.seekDragging) {
				seekSlider.max = String(Math.floor(state.duration));
				seekSlider.value = String(Math.floor(state.currentTime));
			}
			if (timeDisplay) {
				timeDisplay.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
			}
		} else {
			if (seekRow) seekRow.setAttribute("style", "display: none;");
			if (progressEl) {
				(progressEl as HTMLElement).style.display = "";
				progressEl.textContent =
					state.totalSegments > 0
						? `${state.currentSegment} / ${state.totalSegments}`
						: "";
			}
		}

		if (pauseIcon) {
			setIcon(pauseIcon as HTMLElement, state.isPaused ? "play" : "pause");
		}
	}

	setSavedPosition(pos: { x: number; y: number } | null): void {
		this.savedPosition = pos;
		if (this.container && pos) {
			this.container.style.left = `${pos.x}px`;
			this.container.style.top = `${pos.y}px`;
			this.container.style.right = "auto";
			this.container.style.bottom = "auto";
		}
	}

	getPosition(): { x: number; y: number } | null {
		if (!this.container) return this.savedPosition;
		const rect = this.container.getBoundingClientRect();
		return { x: rect.left, y: rect.top };
	}

	private create(): void {
		const el = document.createElement("div");
		el.className = "obsidian-tts-floating-player";

		// Header
		const header = document.createElement("div");
		header.className = "obsidian-tts-player-header";

		const title = document.createElement("span");
		title.className = "obsidian-tts-player-title";
		title.textContent = "朗读中";

		const closeBtn = document.createElement("span");
		closeBtn.className = "obsidian-tts-player-close";
		closeBtn.setAttribute("aria-label", "关闭");
		setIcon(closeBtn, "x");

		header.appendChild(title);
		header.appendChild(closeBtn);

		// Body: controls row
		const body = document.createElement("div");
		body.className = "obsidian-tts-player-body";

		const backwardBtn = document.createElement("span");
		backwardBtn.className = "obsidian-tts-player-backward";
		backwardBtn.setAttribute("aria-label", "后退10秒");
		backwardBtn.setAttribute("title", "后退10秒");
		setIcon(backwardBtn, "rotate-ccw");

		const pauseBtn = document.createElement("span");
		pauseBtn.className = "obsidian-tts-player-pause";
		const pauseIcon = document.createElement("span");
		pauseIcon.className = "obsidian-tts-player-pause-icon";
		setIcon(pauseIcon, "pause");
		pauseBtn.appendChild(pauseIcon);

		const stopBtn = document.createElement("span");
		stopBtn.className = "obsidian-tts-player-stop";
		stopBtn.setAttribute("aria-label", "停止");
		setIcon(stopBtn, "square");

		const forwardBtn = document.createElement("span");
		forwardBtn.className = "obsidian-tts-player-forward";
		forwardBtn.setAttribute("aria-label", "前进10秒");
		forwardBtn.setAttribute("title", "前进10秒");
		setIcon(forwardBtn, "rotate-cw");

		body.appendChild(backwardBtn);
		body.appendChild(pauseBtn);
		body.appendChild(stopBtn);
		body.appendChild(forwardBtn);

		// Progress row (segment progress - shown during synthesis)
		const progress = document.createElement("span");
		progress.className = "obsidian-tts-player-progress";

		// Seek row (time slider - shown during playback)
		const seekRow = document.createElement("div");
		seekRow.className = "obsidian-tts-player-seek-row";
		seekRow.style.display = "none";

		const seekSlider = document.createElement("input");
		seekSlider.type = "range";
		seekSlider.className = "obsidian-tts-player-seek";
		seekSlider.min = "0";
		seekSlider.max = "0";
		seekSlider.value = "0";

		const timeDisplay = document.createElement("span");
		timeDisplay.className = "obsidian-tts-player-time";
		timeDisplay.textContent = "0:00 / 0:00";

		seekRow.appendChild(seekSlider);
		seekRow.appendChild(timeDisplay);

		el.appendChild(header);
		el.appendChild(body);
		el.appendChild(progress);
		el.appendChild(seekRow);

		if (this.savedPosition) {
			el.style.left = `${this.savedPosition.x}px`;
			el.style.top = `${this.savedPosition.y}px`;
		}

		// Drag
		header.addEventListener("mousedown", (e) => this.startDrag(e, el));

		// Button events
		closeBtn.addEventListener("click", () => this.hide());
		pauseBtn.addEventListener("click", () => this.onPause());
		stopBtn.addEventListener("click", () => this.onStop());
		forwardBtn.addEventListener("click", () => this.onJumpForward());
		backwardBtn.addEventListener("click", () => this.onJumpBackward());

		// Seek slider events
		seekSlider.addEventListener("mousedown", () => {
			this.seekDragging = true;
		});
		seekSlider.addEventListener("input", () => {
			const value = parseFloat(seekSlider.value);
			if (timeDisplay) {
				const duration = parseFloat(seekSlider.max) || 0;
				timeDisplay.textContent = `${formatTime(value)} / ${formatTime(duration)}`;
			}
		});
		seekSlider.addEventListener("change", () => {
			this.seekDragging = false;
			const value = parseFloat(seekSlider.value);
			this.onSeek(value);
		});

		document.body.appendChild(el);
		this.container = el;
	}

	private startDrag(e: MouseEvent, el: HTMLElement): void {
		if ((e.target as HTMLElement).closest("span.obsidian-tts-player-close, span.obsidian-tts-player-pause, span.obsidian-tts-player-stop, span.obsidian-tts-player-forward, span.obsidian-tts-player-backward")) return;
		this.dragging = true;
		const rect = el.getBoundingClientRect();
		this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

		const onMove = (ev: MouseEvent) => {
			if (!this.dragging) return;
			el.style.left = `${ev.clientX - this.dragOffset.x}px`;
			el.style.top = `${ev.clientY - this.dragOffset.y}px`;
			el.style.right = "auto";
			el.style.bottom = "auto";
		};

		const onUp = () => {
			this.dragging = false;
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}

	destroy(): void {
		this.container?.remove();
		this.container = null;
	}
}

function formatTime(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) seconds = 0;
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}
