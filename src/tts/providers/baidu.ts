import type { ObsidianTtsSettings } from "../../settings/types";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";
import { SynthesisOptions, TTSProvider } from "../provider";

interface TokenCache {
	token: string;
	expiresAt: number;
}

export class BaiduProvider implements TTSProvider {
	readonly id = "baidu";
	readonly name = "百度智能云 TTS";
	readonly requiresApiKey = true;

	private config: ObsidianTtsSettings["baidu"];
	private tokenCache: TokenCache | null = null;

	constructor(config: ObsidianTtsSettings["baidu"]) {
		this.config = config;
	}

	updateConfig(config: ObsidianTtsSettings["baidu"]): void {
		this.config = config;
		this.tokenCache = null;
	}

	async synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		if (!this.config.apiKey || !this.config.secretKey) {
			throw new Error("请先在设置中配置百度 API Key 和 Secret Key");
		}

		const token = await this.getAccessToken();
		const params = new URLSearchParams({
			tex: text,
			tok: token,
			cuid: "obsidian-tts",
			ctp: "1",
			lan: "zh",
			per: String(this.config.voice),
			spd: String(this.mapRateToBaidu(options.rate, this.config.speed)),
			pit: String(this.config.pitch),
			vol: String(this.config.volume),
			aue: "3",
		});
		const body = params.toString();

		logInfo("[baidu] 合成请求", {
			voice: this.config.voice,
			textLength: text.length,
		});

		try {
			const response = await loggedRequest(
				"baidu",
				{
					url: "https://tsn.baidu.com/text2audio",
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body,
				},
				`tex=${text.slice(0, 80)}...&per=${this.config.voice}`
			);

			if (response.status >= 400) {
				throw new Error(
					`HTTP ${response.status}: ${response.text?.slice(0, 500) || "(无响应体)"}`
				);
			}

			const contentType = response.headers["content-type"] || "";
			if (contentType.includes("application/json")) {
				throw new Error(`百度 TTS 错误: ${response.text}`);
			}

			const buf = response.arrayBuffer;
			if (!buf || buf.byteLength === 0) {
				throw new Error("响应体为空，未收到音频数据");
			}
			return buf;
		} catch (err) {
			logError("[baidu] 合成失败", err);
			if (err instanceof Error && err.message.startsWith("HTTP ")) {
				throw new Error(`百度 TTS 请求失败: ${err.message}`);
			}
			if (err instanceof Error && err.message.startsWith("百度 TTS 错误:")) {
				throw err;
			}
			throw new Error(`百度 TTS 失败: ${formatError(err)}`);
		}
	}

	getMaxChunkSize(): number {
		return 120;
	}

	private mapRateToBaidu(rate: number, baseSpeed: number): number {
		const scaled = Math.round(baseSpeed * rate);
		return Math.max(0, Math.min(15, scaled));
	}

	private async getAccessToken(): Promise<string> {
		const now = Date.now();
		if (this.tokenCache && this.tokenCache.expiresAt > now + 60_000) {
			return this.tokenCache.token;
		}

		const url =
			`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials` +
			`&client_id=${encodeURIComponent(this.config.apiKey)}` +
			`&client_secret=${encodeURIComponent(this.config.secretKey)}`;

		logInfo("[baidu] 获取 access_token");

		try {
			const response = await loggedRequest("baidu", { url, method: "POST" });

			if (response.status >= 400) {
				throw new Error(
					`HTTP ${response.status}: ${response.text?.slice(0, 500) || "(无响应体)"}`
				);
			}

			const json = response.json as {
				access_token?: string;
				expires_in?: number;
			};
			if (!json.access_token) {
				throw new Error("百度 Token 响应无效");
			}

			this.tokenCache = {
				token: json.access_token,
				expiresAt: now + (json.expires_in ?? 2592000) * 1000,
			};
			return json.access_token;
		} catch (err) {
			logError("[baidu] Token 获取失败", err);
			if (err instanceof Error && err.message.startsWith("HTTP ")) {
				throw new Error(`百度 Token 获取失败: ${err.message}`);
			}
			throw new Error(`百度 Token 获取失败: ${formatError(err)}`);
		}
	}
}
