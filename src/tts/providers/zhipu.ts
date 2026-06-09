import { requestUrl } from "obsidian";
import type { ObsidianTtsSettings } from "../../settings/types";
import { SynthesisOptions, TTSProvider } from "../provider";

export class ZhipuProvider implements TTSProvider {
	readonly id = "zhipu";
	readonly name = "智谱 GLM-TTS";
	readonly requiresApiKey = true;

	constructor(private config: ObsidianTtsSettings["zhipu"]) {}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey) {
			throw new Error("请先在设置中配置智谱 API Key");
		}

		const response = await requestUrl({
			url: "https://open.bigmodel.cn/api/paas/v4/audio/speech",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.config.apiKey}`,
			},
			body: JSON.stringify({
				model: "glm-tts",
				input: text,
				voice: options.voice || this.config.voice,
				speed: options.rate * this.config.speed,
				volume: this.config.volume,
				response_format: this.config.responseFormat,
			}),
		});

		if (response.status >= 400) {
			throw new Error(`智谱 GLM-TTS 请求失败 (${response.status}): ${response.text}`);
		}
		return response.arrayBuffer;
	}

	getMaxChunkSize(): number {
		return 4096;
	}
}
