import type { ObsidianTtsSettings } from "../../settings/types";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";
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
		const body = {
			text,
			model_id: this.config.modelId,
			voice_settings: {
				stability: 0.5,
				similarity_boost: 0.75,
			},
		};
		const bodyStr = JSON.stringify(body);

		logInfo("[elevenlabs] 合成请求", {
			voiceId,
			modelId: this.config.modelId,
			textLength: text.length,
		});

		try {
			const response = await loggedRequest(
				"elevenlabs",
				{
					url,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"xi-api-key": this.config.apiKey,
						Accept: "audio/mpeg",
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
			logError("[elevenlabs] 合成失败", err);
			if (err instanceof Error && err.message.startsWith("HTTP ")) {
				throw new Error(`ElevenLabs TTS 请求失败: ${err.message}`);
			}
			throw new Error(`ElevenLabs TTS 失败: ${formatError(err)}`);
		}
	}

	getMaxChunkSize(): number {
		return 5000;
	}
}
