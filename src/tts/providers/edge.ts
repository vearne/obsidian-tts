import { Notice, Platform } from "obsidian";
import type { ObsidianTtsSettings } from "../../settings/types";
import { loggedRequest } from "../../utils/http";
import { formatError, logError, logInfo } from "../../utils/logger";
import {
	SynthesisOptions,
	TTSProvider,
	concatArrayBuffers,
	rateToProsodyPercent,
} from "../provider";
import { Communicate } from "edge-tts-universal";

async function synthesizeDirect(
	text: string,
	voice: string,
	rate: number,
	onStreamChunk?: (chunk: Uint8Array) => void
): Promise<ArrayBuffer> {
	if (Platform.isMobile) {
		throw new Error("移动端不支持 Edge TTS 直连，请配置代理 URL");
	}

	const options: Record<string, string> = { voice };
	const rateStr = rateToProsodyPercent(rate);
	if (rateStr !== "+0%") {
		options.rate = rateStr;
	}

	logInfo("[edge] WSS 直连合成", {
		voice,
		rate: rateStr,
		textLength: text.length,
	});

	const communicate = new Communicate(text, options);
	const chunks: Uint8Array[] = [];
	try {
		for await (const chunk of communicate.stream()) {
			if (chunk.type === "audio" && chunk.data) {
				const data = chunk.data as Uint8Array | ArrayBuffer | Buffer;
				if (data instanceof Uint8Array) {
					chunks.push(data);
					onStreamChunk?.(data);
				} else if (data instanceof ArrayBuffer) {
					const arr = new Uint8Array(data);
					chunks.push(arr);
					onStreamChunk?.(arr);
				} else if (
					typeof Buffer !== "undefined" &&
					Buffer.isBuffer(data)
				) {
					const arr = new Uint8Array(data);
					chunks.push(arr);
					onStreamChunk?.(arr);
				}
			}
		}
	} catch (err) {
		logError("[edge] WSS 直连失败", err);
		const msg = formatError(err);
		if (/403|WebSocket|wss/i.test(msg)) {
			throw new Error(
				`Edge TTS WSS 连接失败: ${msg}。可改用「仅代理」模式并配置 openai-edge-tts 地址`
			);
		}
		throw new Error(`Edge TTS 直连失败: ${msg}`);
	}

	if (chunks.length === 0) {
		throw new Error("Edge TTS 未返回音频数据");
	}

	const totalBytes = chunks.reduce((sum, c) => sum + c.byteLength, 0);
	logInfo("[edge] WSS 直连完成", { chunks: chunks.length, totalBytes });
	return concatArrayBuffers(
		chunks.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer)
	);
}

async function synthesizeViaProxy(
	text: string,
	proxyUrl: string,
	voice: string,
	rate: number
): Promise<ArrayBuffer> {
	const baseUrl = proxyUrl.replace(/\/$/, "");
	const url = `${baseUrl}/audio/speech`;
	const body = {
		model: "tts-1",
		input: text,
		voice,
		speed: rate,
	};
	const bodyStr = JSON.stringify(body);

	logInfo("[edge] 代理合成请求", {
		proxyUrl: baseUrl,
		voice,
		textLength: text.length,
	});

	try {
		const response = await loggedRequest(
			"edge-proxy",
			{
				url,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer not-needed",
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
		logError("[edge] 代理合成失败", err);
		if (err instanceof Error && err.message.startsWith("HTTP ")) {
			throw new Error(`Edge TTS 代理请求失败: ${err.message}`);
		}
		throw new Error(`Edge TTS 代理失败: ${formatError(err)}`);
	}
}

export class EdgeProvider implements TTSProvider {
	readonly id = "edge";
	readonly name = "Edge TTS";
	readonly requiresApiKey = false;

	constructor(
		private config: ObsidianTtsSettings["edge"],
		private showNotices = false
	) {}

	synthesize(text: string, options: SynthesisOptions): Promise<ArrayBuffer> {
		const voice = options.voice || this.config.voice;
		const mode = this.config.connectionMode;

		logInfo("[edge] 开始合成", {
			mode,
			voice,
			textLength: text.length,
		});

		if (mode === "proxy" || Platform.isMobile) {
			return this.proxySynthesize(text, voice, options.rate);
		}

		if (mode === "direct") {
			return synthesizeDirect(
				text,
				voice,
				options.rate,
				options.onStreamChunk
			);
		}

		return synthesizeDirect(text, voice, options.rate).catch(async (directErr) => {
			if (this.config.proxyUrl.trim()) {
				logWarnFallback(directErr);
				if (this.showNotices) {
					new Notice("Edge TTS 直连失败，正在尝试代理...", 3000);
				}
				return synthesizeViaProxy(
					text,
					this.config.proxyUrl,
					voice,
					options.rate
				);
			}
			const directMsg = formatError(directErr);
			throw new Error(
				`${directMsg}\n\n` +
					"解决方案：\n" +
					"1. 设置 → Obsidian TTS → Edge TTS → 连接模式选「仅代理」\n" +
					"2. 部署 openai-edge-tts 并填写代理 URL（如 http://localhost:5050/v1）\n" +
					"3. 或切换到智谱/阿里云/OpenAI 等其它 Provider"
			);
		});
	}

	private async proxySynthesize(
		text: string,
		voice: string,
		rate: number
	): Promise<ArrayBuffer> {
		if (!this.config.proxyUrl.trim()) {
			throw new Error(
				"请配置 Edge TTS 代理 URL（如 http://localhost:5050/v1）。" +
					"可先运行: docker run -p 5050:5050 travisvn/openai-edge-tts"
			);
		}
		return synthesizeViaProxy(text, this.config.proxyUrl, voice, rate);
	}

	getMaxChunkSize(): number {
		return 3000;
	}
}

function logWarnFallback(err: unknown): void {
	logError("[edge] 直连失败，回退代理", err);
}
