import type { ObsidianTtsSettings } from "../../settings/types";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";
import { SynthesisOptions, TTSProvider } from "../provider";

export class AliyunProvider implements TTSProvider {
	readonly id = "aliyun";
	readonly name = "阿里云 CosyVoice";
	readonly requiresApiKey = true;

	constructor(private config: ObsidianTtsSettings["aliyun"]) {}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey) {
			throw new Error("请先在设置中配置阿里云 DashScope API Key");
		}

		const voice = options.voice || this.config.voice;
		const url = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer";
		const body = {
			model: this.config.model,
			input: {
				text,
				voice,
				format: this.config.format,
				sample_rate: this.config.sampleRate,
				rate: options.rate,
				pitch: options.pitch ?? 1.0,
				volume: this.config.volume,
			},
		};
		const bodyStr = JSON.stringify(body);

		logInfo("[aliyun] 合成请求", {
			model: this.config.model,
			voice,
			format: this.config.format,
			sampleRate: this.config.sampleRate,
			volume: this.config.volume,
			textLength: text.length,
		});

		try {
			// Step 1: POST synthesis request → get audio URL
			const response = await loggedRequest(
				"aliyun",
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

			const json = response.json as {
				output?: {
					audio?: {
						url?: string;
					};
				};
			};
			const audioUrl = json?.output?.audio?.url;
			if (!audioUrl) {
				throw new Error("阿里云 CosyVoice 未返回音频 URL");
			}

			logInfo("[aliyun] 获取到音频 URL，开始下载", {
				urlLength: audioUrl.length,
			});

			// Step 2: GET audio URL → download binary data
			const audioResponse = await loggedRequest("aliyun", {
				url: audioUrl,
				method: "GET",
			});

			if (audioResponse.status >= 400) {
				throw new Error(
					`下载音频失败 HTTP ${audioResponse.status}: ${audioResponse.text?.slice(0, 500) || "(无响应体)"}`
				);
			}

			return audioResponse.arrayBuffer;
		} catch (err) {
			logError("[aliyun] 合成失败", err);
			if (err instanceof Error && err.message.startsWith("HTTP ")) {
				throw new Error(`阿里云 CosyVoice 请求失败: ${err.message}`);
			}
			throw new Error(`阿里云 CosyVoice 失败: ${formatError(err)}`);
		}
	}

	getMaxChunkSize(): number {
		return 5000;
	}
}
