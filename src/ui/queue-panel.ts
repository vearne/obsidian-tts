import { setIcon } from "obsidian";
import type { QueueItem } from "../audio/queue-manager";

export class QueuePanel {
	private container: HTMLElement | null = null;
	private highlightId: string | null = null;

	constructor(
		private getItems: () => QueueItem[],
		private onRemove: (id: string) => void,
		private onClear: () => void
	) {}

	setHighlightId(id: string | null): void {
		this.highlightId = id;
		this.render();
	}

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

		const header = document.createElement("div");
		header.className = "obsidian-tts-queue-header";

		const headerTitle = document.createElement("span");
		headerTitle.className = "obsidian-tts-queue-header-title";
		const headerIcon = document.createElement("span");
		headerIcon.className = "obsidian-tts-queue-header-icon";
		setIcon(headerIcon, "list-music");
		headerTitle.appendChild(headerIcon);
		headerTitle.appendChild(document.createTextNode("播放队列"));
		header.appendChild(headerTitle);

		const clearBtn = document.createElement("button");
		clearBtn.className = "obsidian-tts-queue-clear";
		clearBtn.setAttribute("aria-label", "清空");
		setIcon(clearBtn, "trash-2");
		clearBtn.addEventListener("click", () => {
			this.onClear();
			this.render();
		});
		header.appendChild(clearBtn);

		const list = document.createElement("ul");
		list.className = "obsidian-tts-queue-list";

		el.appendChild(header);
		el.appendChild(list);
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
			if (item.id === this.highlightId) {
				li.addClass("obsidian-tts-queue-active");
			}
			const span = document.createElement("span");
			span.textContent = item.title;
			li.appendChild(span);
			const btn = document.createElement("button");
			btn.className = "obsidian-tts-queue-remove";
			btn.setAttribute("aria-label", "移除");
			setIcon(btn, "x");
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
