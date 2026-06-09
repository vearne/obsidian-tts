import type { PlaybackState } from "../audio/playback-manager";

export class FloatingPlayer {
	private container: HTMLElement | null = null;
	private onPause: () => void;
	private onStop: () => void;
	private savedPosition: { x: number; y: number } | null = null;
	private dragging = false;
	private dragOffset = { x: 0, y: 0 };

	constructor(
		onPause: () => void,
		onStop: () => void,
		savedPosition: { x: number; y: number } | null
	) {
		this.onPause = onPause;
		this.onStop = onStop;
		this.savedPosition = savedPosition;
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
		const progressEl = this.container.querySelector(".obsidian-tts-player-progress");
		const pauseBtn = this.container.querySelector(
			".obsidian-tts-player-pause"
		) as HTMLButtonElement;

		if (titleEl) titleEl.textContent = state.title || "朗读中";
		if (progressEl) {
			progressEl.textContent =
				state.totalSegments > 0
					? `${state.currentSegment} / ${state.totalSegments}`
					: "";
		}
		if (pauseBtn) {
			pauseBtn.textContent = state.isPaused ? "继续" : "暂停";
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
		el.innerHTML = `
			<div class="obsidian-tts-player-header">
				<span class="obsidian-tts-player-title">朗读中</span>
				<button class="obsidian-tts-player-close" aria-label="关闭">×</button>
			</div>
			<div class="obsidian-tts-player-body">
				<span class="obsidian-tts-player-progress"></span>
				<button class="obsidian-tts-player-pause">暂停</button>
				<button class="obsidian-tts-player-stop">停止</button>
			</div>
		`;

		if (this.savedPosition) {
			el.style.left = `${this.savedPosition.x}px`;
			el.style.top = `${this.savedPosition.y}px`;
		}

		const header = el.querySelector(".obsidian-tts-player-header") as HTMLElement;
		header.addEventListener("mousedown", (e) => this.startDrag(e, el));

		el.querySelector(".obsidian-tts-player-close")?.addEventListener("click", () =>
			this.hide()
		);
		el.querySelector(".obsidian-tts-player-pause")?.addEventListener("click", () =>
			this.onPause()
		);
		el.querySelector(".obsidian-tts-player-stop")?.addEventListener("click", () =>
			this.onStop()
		);

		document.body.appendChild(el);
		this.container = el;
	}

	private startDrag(e: MouseEvent, el: HTMLElement): void {
		if ((e.target as HTMLElement).closest("button")) return;
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
