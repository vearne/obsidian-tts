const DB_NAME = "obsidian-tts-cache";
const STORE_NAME = "audio";
const DB_VERSION = 1;
const MAX_ENTRIES = 200;

async function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
				store.createIndex("lastUsed", "lastUsed", { unique: false });
			}
		};
	});
}

export async function buildCacheKey(
	providerId: string,
	voice: string,
	rate: number,
	text: string
): Promise<string> {
	const payload = `${providerId}\0${voice}\0${rate}\0${text}`;
	const data = new TextEncoder().encode(payload);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export class TTSCache {
	constructor(private enabled: boolean) {}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	async get(key: string): Promise<ArrayBuffer | null> {
		if (!this.enabled) return null;
		try {
			const db = await openDb();
			return new Promise((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				const store = tx.objectStore(STORE_NAME);
				const req = store.get(key);
				req.onsuccess = () => {
					const entry = req.result as
						| { key: string; data: ArrayBuffer; lastUsed: number }
						| undefined;
					if (!entry) {
						resolve(null);
						return;
					}
					entry.lastUsed = Date.now();
					store.put(entry);
					resolve(entry.data);
				};
				req.onerror = () => reject(req.error);
			});
		} catch {
			return null;
		}
	}

	async set(key: string, data: ArrayBuffer): Promise<void> {
		if (!this.enabled) return;
		try {
			const db = await openDb();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				const store = tx.objectStore(STORE_NAME);
				store.put({ key, data, lastUsed: Date.now() });
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			await this.evictIfNeeded();
		} catch {
			// cache write failure is non-fatal
		}
	}

	private async evictIfNeeded(): Promise<void> {
		try {
			const db = await openDb();
			const entries: { key: string; lastUsed: number }[] = await new Promise(
				(resolve, reject) => {
					const tx = db.transaction(STORE_NAME, "readonly");
					const store = tx.objectStore(STORE_NAME);
					const req = store.getAll();
					req.onsuccess = () => resolve(req.result);
					req.onerror = () => reject(req.error);
				}
			);
			if (entries.length <= MAX_ENTRIES) return;
			entries.sort((a, b) => a.lastUsed - b.lastUsed);
			const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				const store = tx.objectStore(STORE_NAME);
				for (const entry of toRemove) {
					store.delete(entry.key);
				}
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} catch {
			// eviction failure is non-fatal
		}
	}

	async clear(): Promise<void> {
		try {
			const db = await openDb();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				tx.objectStore(STORE_NAME).clear();
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} catch {
			// ignore
		}
	}
}
