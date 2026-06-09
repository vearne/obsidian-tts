import { requestUrl } from "obsidian";
import type { ObsidianTtsSettings } from "../../settings/types";
import { SynthesisOptions, TTSProvider, arrayBufferToBase64 } from "../provider";

export class GoogleProvider implements TTSProvider {
	readonly id = "google";
	readonly name = "Google Cloud TTS";
	readonly requiresApiKey = true;

	constructor(private config: ObsidianTtsSettings["google"]) {}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey) {
			throw new Error("请先在设置中配置 Google Cloud API Key");
		}

		const voiceName = options.voice || this.config.voiceName;
		const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.config.apiKey}`;

		const response = await requestUrl({
			url,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				input: { text },
				voice: {
					languageCode: this.config.languageCode,
					name: voiceName,
				},
				audioConfig: {
					audioEncoding: "MP3",
					speakingRate: options.rate,
				},
			}),
		});

		if (response.status >= 400) {
			throw new Error(`Google TTS 请求失败 (${response.status}): ${response.text}`);
		}

		const json = response.json as { audioContent?: string };
		if (!json.audioContent) {
			throw new Error("Google TTS 未返回音频数据");
		}

		const binary = atob(json.audioContent);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes.buffer;
	}

	getMaxChunkSize(): number {
		return 5000;
	}
}
