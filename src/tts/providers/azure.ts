import { requestUrl } from "obsidian";
import type { ObsidianTtsSettings } from "../../settings/types";
import { SynthesisOptions, TTSProvider, arrayBufferToBase64 } from "../provider";

export class AzureProvider implements TTSProvider {
	readonly id = "azure";
	readonly name = "Azure Speech";
	readonly requiresApiKey = true;

	constructor(private config: ObsidianTtsSettings["azure"]) {}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey) {
			throw new Error("请先在设置中配置 Azure API Key");
		}

		const voice = options.voice || this.config.voice;
		const ratePercent = Math.round((options.rate - 1) * 100);
		const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

		const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
  <voice name="${voice}">
    <prosody rate="${rateStr}">${escapeXml(text)}</prosody>
  </voice>
</speak>`;

		const url = `https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
		const response = await requestUrl({
			url,
			method: "POST",
			headers: {
				"Ocp-Apim-Subscription-Key": this.config.apiKey,
				"Content-Type": "application/ssml+xml",
				"X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
			},
			body: ssml,
		});

		if (response.status >= 400) {
			throw new Error(`Azure TTS 请求失败 (${response.status}): ${response.text}`);
		}
		return response.arrayBuffer;
	}

	getMaxChunkSize(): number {
		return 5000;
	}
}

function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
