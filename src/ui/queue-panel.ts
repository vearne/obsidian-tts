import type { QueueItem } from "../audio/queue-manager";

export class QueuePanel {
	private container: HTMLElement | null = null;

	constructor(
		private getItems: () => QueueItem[],
		private onRemove: (id: string) => void,
		private onClear: () => void
	) {}

	show(): void {
		if (!this.container) this.create();
		this.render();
		if (this.container) this.container.style.display = "block";
	}

	hide(): void {
		if (this.container) this.container.style.display = "none";
	}

	update(): void {
		this.render();
	}

	private create(): void {
		const el = document.createElement("div");
		el.className = "obsidian-tts-queue-panel";
		el.innerHTML = `
			<div class="obsidian-tts-queue-header">
				<span>播放队列</span>
				<button class="obsidian-tts-queue-clear">清空</button>
			</div>
			<ul class="obsidian-tts-queue-list"></ul>
		`;
		el.querySelector(".obsidian-tts-queue-clear")?.addEventListener("click", () => {
			this.onClear();
			this.render();
		});
		document.body.appendChild(el);
		this.container = el;
	}

	private render(): void {
		if (!this.container) return;
		const list = this.container.querySelector(
			".obsidian-tts-queue-list"
		) as HTMLElement;
		if (!list) return;

		list.innerHTML = "";
		const items = this.getItems();
		if (items.length === 0) {
			const empty = document.createElement("li");
			empty.className = "obsidian-tts-queue-empty";
			empty.textContent = "队列为空";
			list.appendChild(empty);
			return;
		}

		for (const item of items) {
			const li = document.createElement("li");
			li.className = "obsidian-tts-queue-item";
			const span = document.createElement("span");
			span.textContent = item.title;
			li.appendChild(span);
			const btn = document.createElement("button");
			btn.textContent = "移除";
			btn.addEventListener("click", () => {
				this.onRemove(item.id);
				this.render();
			});
			li.appendChild(btn);
			list.appendChild(li);
		}
	}

	destroy(): void {
		this.container?.remove();
		this.container = null;
	}
}
