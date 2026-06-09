import { requestUrl } from "obsidian";
import { SynthesisOptions, TTSProvider } from "../provider";

export interface OpenAIProviderConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
	defaultVoice: string;
}

export class OpenAIProvider implements TTSProvider {
	readonly id: string;
	readonly name: string;
	readonly requiresApiKey = true;

	constructor(private config: OpenAIProviderConfig) {
		this.id = config.baseUrl.includes("api.openai.com")
			? "openai"
			: "openai-compatible";
		this.name =
			this.id === "openai" ? "OpenAI TTS" : "OpenAI 兼容 API";
	}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey && this.id === "openai") {
			throw new Error("请先在设置中配置 OpenAI API Key");
		}

		const url = `${this.config.baseUrl.replace(/\/$/, "")}/audio/speech`;
		const response = await requestUrl({
			url,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.config.apiKey}`,
			},
			body: JSON.stringify({
				model: this.config.model,
				input: text,
				voice: options.voice || this.config.defaultVoice,
				speed: options.rate,
			}),
		});

		if (response.status >= 400) {
			throw new Error(`OpenAI TTS 请求失败 (${response.status}): ${response.text}`);
		}
		return response.arrayBuffer;
	}

	getMaxChunkSize(): number {
		return 4096;
	}
}
