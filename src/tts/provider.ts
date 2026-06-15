export interface VoiceInfo {
	id: string;
	name: string;
	locale?: string;
}

export type StreamChunkCallback = (chunk: Uint8Array) => void;

export interface SynthesisOptions {
	voice: string;
	rate: number;
	pitch?: number;
	volume?: number;
	format?: "mp3" | "wav" | "opus";
	onStreamChunk?: StreamChunkCallback;
}

export interface TTSProvider {
	readonly id: string;
	readonly name: string;
	readonly requiresApiKey: boolean;

	synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer>;
	getMaxChunkSize(): number;
	listVoices?(): Promise<VoiceInfo[]>;
}

export function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
	const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const buf of buffers) {
		result.set(new Uint8Array(buf), offset);
		offset += buf.byteLength;
	}
	return result.buffer;
}

export function rateToProsodyPercent(rate: number): string {
	const pct = Math.round((rate - 1) * 100);
	if (pct === 0) return "+0%";
	return pct > 0 ? `+${pct}%` : `${pct}%`;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export function getMimeType(format?: string): string {
	switch (format) {
		case "wav":
			return "audio/wav";
		case "opus":
			return "audio/opus";
		default:
			return "audio/mpeg";
	}
}
