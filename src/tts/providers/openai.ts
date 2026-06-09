import { SynthesisOptions, TTSProvider } from "../provider";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";

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
		const body = {
			model: this.config.model,
			input: text,
			voice: options.voice || this.config.defaultVoice,
			speed: options.rate,
		};
		const bodyStr = JSON.stringify(body);

		logInfo(`[${this.id}] 合成请求`, {
			baseUrl: this.config.baseUrl,
			model: this.config.model,
			voice: body.voice,
			textLength: text.length,
		});

		try {
			const response = await loggedRequest(
				this.id,
				{
					url,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.config.apiKey}`,
					},
					body: bodyStr,
				},
				bodyStr
			);

			if (response.status >= 400) {
				throw new Error(
					`HTTP ${response.status}: ${response.text?.slice(0, 500) || "(无响应体)"}`
				);
			}

			const buf = response.arrayBuffer;
			if (!buf || buf.byteLength === 0) {
				throw new Error("响应体为空，未收到音频数据");
			}
			return buf;
		} catch (err) {
			logError(`[${this.id}] 合成失败`, err);
			if (err instanceof Error && err.message.startsWith("HTTP ")) {
				throw err;
			}
			throw new Error(`${this.name} 失败: ${formatError(err)}`);
		}
	}

	getMaxChunkSize(): number {
		return 4096;
	}
}
