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
		const list = this.container.querySelector(".obsidian-tts-queue-list");
		if (!list) return;

		list.empty();
		const items = this.getItems();
		if (items.length === 0) {
			const empty = list.createEl("li", { cls: "obsidian-tts-queue-empty" });
			empty.textContent = "队列为空";
			return;
		}

		for (const item of items) {
			const li = list.createEl("li", { cls: "obsidian-tts-queue-item" });
			li.createSpan({ text: item.title });
			const btn = li.createEl("button", { text: "移除" });
			btn.addEventListener("click", () => {
				this.onRemove(item.id);
				this.render();
			});
		}
	}

	destroy(): void {
		this.container?.remove();
		this.container = null;
	}
}
