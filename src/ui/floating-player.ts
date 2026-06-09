import { setIcon } from "obsidian";
import type { PlaybackState } from "../audio/playback-manager";
import type { QueueItem } from "../audio/queue-manager";

export class FloatingPlayer {
	private container: HTMLElement | null = null;
	private onPause: () => void;
	private onStop: () => void;
	private onSeek: (time: number) => void;
	private onJumpForward: () => void;
	private onJumpBackward: () => void;
	private getQueueItems: (() => QueueItem[]) | null = null;
	private onRemoveQueueItem: ((id: string) => void) | null = null;
	private savedPosition: { x: number; y: number } | null = null;
	private dragging = false;
	private dragOffset = { x: 0, y: 0 };
	private seekDragging = false;
	private queueExpanded = false;

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

	setQueueCallbacks(
		getItems: () => QueueItem[],
		onRemove: (id: string) => void
	): void {
		this.getQueueItems = getItems;
		this.onRemoveQueueItem = onRemove;
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

		const pauseBtn = this.container.querySelector(".obsidian-tts-player-pause");
		const stopBtn = this.container.querySelector(".obsidian-tts-player-stop");
		const forwardBtn = this.container.querySelector(".obsidian-tts-player-forward");
		const backwardBtn = this.container.querySelector(".obsidian-tts-player-backward");

		if (pauseIcon) {
			setIcon(pauseIcon as HTMLElement, state.isPaused ? "play" : "pause");
		}
		if (pauseBtn) {
			pauseBtn.setAttribute(
				"aria-label",
				state.isPaused ? "继续播放" : "暂停"
			);
			pauseBtn.setAttribute(
				"title",
				state.isPaused ? "继续播放" : "暂停"
			);
		}

		this.setControlDisabled(pauseBtn, !state.canTogglePause);
		this.setControlDisabled(stopBtn, !state.canStop);
		this.setControlDisabled(forwardBtn, !state.canSeek);
		this.setControlDisabled(backwardBtn, !state.canSeek);
		if (seekSlider) {
			seekSlider.disabled = !state.canSeek;
		}
	}

	private setControlDisabled(el: Element | null, disabled: boolean): void {
		if (!el) return;
		el.classList.toggle("is-disabled", disabled);
		el.setAttribute("aria-disabled", disabled ? "true" : "false");
	}

	updateQueue(): void {
		if (!this.container) return;
		if (!this.getQueueItems) return;
		const items = this.getQueueItems();
		this.updateQueueCount(items.length);
		if (this.queueExpanded) {
			this.renderQueueList();
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
		pauseBtn.setAttribute("aria-label", "暂停");
		pauseBtn.setAttribute("title", "暂停");
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

		// Queue section
		const queueSection = document.createElement("div");
		queueSection.className = "obsidian-tts-queue-section";

		const queueToggle = document.createElement("div");
		queueToggle.className = "obsidian-tts-queue-toggle";

		const queueToggleIcon = document.createElement("span");
		queueToggleIcon.className = "obsidian-tts-queue-toggle-icon";
		setIcon(queueToggleIcon, "chevron-right");

		const queueToggleLabel = document.createElement("span");
		queueToggleLabel.className = "obsidian-tts-queue-toggle-label";

		const queueCount = document.createElement("span");
		queueCount.className = "obsidian-tts-queue-count";
		queueCount.textContent = "0";

		queueToggleLabel.appendChild(document.createTextNode("待播放列表 "));
		queueToggleLabel.appendChild(queueCount);

		queueToggle.appendChild(queueToggleIcon);
		queueToggle.appendChild(queueToggleLabel);

		const queueList = document.createElement("ul");
		queueList.className = "obsidian-tts-queue-list";
		queueList.style.display = "none";

		queueSection.appendChild(queueToggle);
		queueSection.appendChild(queueList);

		el.appendChild(header);
		el.appendChild(body);
		el.appendChild(progress);
		el.appendChild(seekRow);
		el.appendChild(queueSection);

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

		// Queue toggle
		queueToggle.addEventListener("click", () => {
			this.queueExpanded = !this.queueExpanded;
			queueList.style.display = this.queueExpanded ? "block" : "none";
			setIcon(
				queueToggleIcon,
				this.queueExpanded ? "chevron-down" : "chevron-right"
			);
			if (this.queueExpanded) {
				this.renderQueueList();
			}
		});

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

	private renderQueueList(): void {
		if (!this.container) return;
		const list = this.container.querySelector(
			".obsidian-tts-queue-list"
		) as HTMLElement;
		if (!list) return;

		list.innerHTML = "";

		if (!this.getQueueItems) return;
		const items = this.getQueueItems();

		if (items.length === 0) {
			const empty = document.createElement("li");
			empty.className = "obsidian-tts-queue-empty";
			empty.textContent = "队列为空";
			list.appendChild(empty);
			this.updateQueueCount(0);
			return;
		}

		this.updateQueueCount(items.length);

		for (const item of items) {
			const li = document.createElement("li");
			li.className = "obsidian-tts-queue-item";

			const span = document.createElement("span");
			span.className = "obsidian-tts-queue-item-title";
			span.textContent = item.title;
			li.appendChild(span);

			if (this.onRemoveQueueItem) {
				const btn = document.createElement("button");
				btn.className = "obsidian-tts-queue-item-remove";
				btn.setAttribute("aria-label", "移除");
				setIcon(btn, "x");
				const itemId = item.id;
				btn.addEventListener("click", () => {
					this.onRemoveQueueItem!(itemId);
				});
				li.appendChild(btn);
			}

			list.appendChild(li);
		}
	}

	private updateQueueCount(count: number): void {
		if (!this.container) return;
		const countEl = this.container.querySelector(
			".obsidian-tts-queue-count"
		);
		if (countEl) countEl.textContent = String(count);
	}

	private startDrag(e: MouseEvent, el: HTMLElement): void {
		if ((e.target as HTMLElement).closest("span.obsidian-tts-player-close, span.obsidian-tts-player-pause, span.obsidian-tts-player-stop, span.obsidian-tts-player-forward, span.obsidian-tts-player-backward, .obsidian-tts-queue-section")) return;
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
