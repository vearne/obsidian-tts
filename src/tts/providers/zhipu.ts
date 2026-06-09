import type { ObsidianTtsSettings } from "../../settings/types";
import { ZHIPU_MAX_INPUT_CHARS } from "../../settings/types";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";
import { SynthesisOptions, TTSProvider } from "../provider";

/** @see https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts */
const ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/audio/speech";

const LEGACY_VOICE_MAP: Record<string, string> = {
	female: "tongtong",
	male: "chuichui",
};

/** 智谱 API 仅支持 wav / pcm；兼容旧配置中的 mp3 */
function normalizeResponseFormat(format: string): "wav" | "pcm" {
	if (format === "pcm") return "pcm";
	return "wav";
}

function normalizeVoice(voice: string): string {
	return LEGACY_VOICE_MAP[voice] ?? voice;
}

function clampSpeed(speed: number): number {
	return Math.max(0.5, Math.min(2, speed));
}

function clampVolume(volume: number): number {
	return Math.max(0.1, Math.min(10, volume));
}

function parseZhipuApiError(text: string, status: number): string {
	try {
		const json = JSON.parse(text) as {
			error?: { code?: string; message?: string };
		};
		if (json.error?.message) {
			const code = json.error.code ? `[${json.error.code}] ` : "";
			return `HTTP ${status}: ${code}${json.error.message}`;
		}
	} catch {
		// 非 JSON 响应
	}
	return `HTTP ${status}: ${text?.slice(0, 500) || "(无响应体)"}`;
}

export class ZhipuProvider implements TTSProvider {
	readonly id = "zhipu";
	readonly name = "智谱 GLM-TTS";
	readonly requiresApiKey = true;

	constructor(private config: ObsidianTtsSettings["zhipu"]) {}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey) {
			throw new Error("请先在设置中配置智谱 API Key");
		}

		if (text.length > ZHIPU_MAX_INPUT_CHARS) {
			throw new Error(
				`智谱 GLM-TTS 单段文本不能超过 ${ZHIPU_MAX_INPUT_CHARS} 字（当前 ${text.length} 字）`
			);
		}

		const responseFormat = normalizeResponseFormat(this.config.responseFormat);
		const speed = clampSpeed(options.rate * this.config.speed);
		const volume = clampVolume(this.config.volume);
		const voice = normalizeVoice(options.voice || this.config.voice);

		const body = {
			model: "glm-tts",
			input: text,
			voice,
			speed,
			volume,
			response_format: responseFormat,
			stream: false,
		};
		const bodyStr = JSON.stringify(body);

		logInfo("[zhipu] 合成请求", {
			url: ZHIPU_URL,
			voice: body.voice,
			speed: body.speed,
			volume: body.volume,
			format: body.response_format,
			textLength: text.length,
		});

		try {
			const response = await loggedRequest(
				"zhipu",
				{
					url: ZHIPU_URL,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.config.apiKey}`,
					},
					body: bodyStr,
				},
				bodyStr
			);

			const contentType =
				response.headers?.["content-type"] ??
				response.headers?.["Content-Type"] ??
				"";

			if (response.status >= 400) {
				throw new Error(parseZhipuApiError(response.text ?? "", response.status));
			}

			if (contentType.includes("application/json")) {
				throw new Error(parseZhipuApiError(response.text ?? "", response.status));
			}

			const buf = response.arrayBuffer;
			if (!buf || buf.byteLength === 0) {
				throw new Error("响应体为空，未收到音频数据");
			}
			return buf;
		} catch (err) {
			logError("[zhipu] 合成失败", err);
			if (err instanceof Error && err.message.startsWith("HTTP ")) {
				throw new Error(`智谱 GLM-TTS 请求失败: ${err.message}`);
			}
			throw new Error(`智谱 GLM-TTS 失败: ${formatError(err)}`);
		}
	}

	getMaxChunkSize(): number {
		return ZHIPU_MAX_INPUT_CHARS;
	}
}
