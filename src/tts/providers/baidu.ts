import { requestUrl } from "obsidian";
import type { ObsidianTtsSettings } from "../../settings/types";
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

		const response = await requestUrl({
			url: "https://tsn.baidu.com/text2audio",
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});

		if (response.status >= 400) {
			throw new Error(`百度 TTS 请求失败 (${response.status}): ${response.text}`);
		}

		const contentType = response.headers["content-type"] || "";
		if (contentType.includes("application/json")) {
			throw new Error(`百度 TTS 错误: ${response.text}`);
		}

		return response.arrayBuffer;
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

		const response = await requestUrl({ url, method: "POST" });
		if (response.status >= 400) {
			throw new Error(`百度 Token 获取失败: ${response.text}`);
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
	}
}
