export interface QueueItem {
	id: string;
	title: string;
	text: string;
	filePath?: string;
}

type QueueChangeCallback = () => void;

export class QueueManager {
	private queue: QueueItem[] = [];
	private onChange: QueueChangeCallback | null = null;

	setOnChange(cb: QueueChangeCallback): void {
		this.onChange = cb;
	}

	add(item: QueueItem): void {
		this.queue.push(item);
		this.onChange?.();
	}

	remove(id: string): void {
		this.queue = this.queue.filter((i) => i.id !== id);
		this.onChange?.();
	}

	clear(): void {
		this.queue = [];
		this.onChange?.();
	}

	shift(): QueueItem | undefined {
		const item = this.queue.shift();
		this.onChange?.();
		return item;
	}

	peek(): QueueItem | undefined {
		return this.queue[0];
	}

	getAll(): QueueItem[] {
		return [...this.queue];
	}

	get length(): number {
		return this.queue.length;
	}
}
