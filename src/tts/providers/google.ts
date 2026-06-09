import type { ObsidianTtsSettings } from "../../settings/types";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";
import { SynthesisOptions, TTSProvider } from "../provider";

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
		const body = {
			input: { text },
			voice: {
				languageCode: this.config.languageCode,
				name: voiceName,
			},
			audioConfig: {
				audioEncoding: "MP3",
				speakingRate: options.rate,
			},
		};
		const bodyStr = JSON.stringify(body);

		logInfo("[google] 合成请求", {
			languageCode: this.config.languageCode,
			voice: voiceName,
			textLength: text.length,
		});

		try {
			const response = await loggedRequest(
				"google",
				{
					url,
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: bodyStr,
				},
				bodyStr
			);

			if (response.status >= 400) {
				throw new Error(
					`HTTP ${response.status}: ${response.text?.slice(0, 500) || "(无响应体)"}`
				);
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
		} catch (err) {
			logError("[google] 合成失败", err);
			if (err instanceof Error && err.message.startsWith("HTTP ")) {
				throw new Error(`Google TTS 请求失败: ${err.message}`);
			}
			throw new Error(`Google TTS 失败: ${formatError(err)}`);
		}
	}

	getMaxChunkSize(): number {
		return 5000;
	}
}
