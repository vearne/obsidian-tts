import { requestUrl } from "obsidian";
import type { ObsidianTtsSettings } from "../../settings/types";
import { SynthesisOptions, TTSProvider } from "../provider";

export class ElevenLabsProvider implements TTSProvider {
	readonly id = "elevenlabs";
	readonly name = "ElevenLabs";
	readonly requiresApiKey = true;

	constructor(private config: ObsidianTtsSettings["elevenlabs"]) {}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey) {
			throw new Error("请先在设置中配置 ElevenLabs API Key");
		}

		const voiceId = options.voice || this.config.voiceId;
		const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

		const response = await requestUrl({
			url,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"xi-api-key": this.config.apiKey,
				Accept: "audio/mpeg",
			},
			body: JSON.stringify({
				text,
				model_id: this.config.modelId,
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75,
				},
			}),
		});

		if (response.status >= 400) {
			throw new Error(
				`ElevenLabs TTS 请求失败 (${response.status}): ${response.text}`
			);
		}
		return response.arrayBuffer;
	}

	getMaxChunkSize(): number {
		return 5000;
	}
}
