import { isPcmContentType, pcmToWav } from "../../audio/wav";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";
import { SynthesisOptions, TTSProvider } from "../provider";

export interface OpenAIProviderConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
	defaultVoice: string;
	/** 空字符串表示不发送该字段（标准 OpenAI 默认 MP3） */
	responseFormat?: "" | "mp3" | "wav" | "pcm" | "opus";
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
		const body: Record<string, unknown> = {
			model: this.config.model,
			input: text,
			voice: options.voice || this.config.defaultVoice,
			speed: options.rate,
		};
		if (this.config.responseFormat) {
			body.response_format = this.config.responseFormat;
		}
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

			const contentType =
				response.headers?.["content-type"] ??
				response.headers?.["Content-Type"] ??
				"";

			let buf = response.arrayBuffer;
			if (!buf || buf.byteLength === 0) {
				throw new Error("响应体为空，未收到音频数据");
			}

			if (isPcmContentType(contentType) || this.config.responseFormat === "pcm") {
				logInfo(`[${this.id}] PCM 响应，封装为 WAV 以便播放`, {
					byteLength: buf.byteLength,
				});
				buf = pcmToWav(buf);
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
