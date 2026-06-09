import type { ObsidianTtsSettings } from "../settings/types";
import type { TTSProvider } from "./provider";
import { EdgeProvider } from "./providers/edge";
import { OpenAIProvider } from "./providers/openai";
import { AzureProvider } from "./providers/azure";
import { GoogleProvider } from "./providers/google";
import { ElevenLabsProvider } from "./providers/elevenlabs";
import { ZhipuProvider } from "./providers/zhipu";
import { BaiduProvider } from "./providers/baidu";

export class ProviderRegistry {
	private settings: ObsidianTtsSettings;
	private baiduProvider: BaiduProvider;

	constructor(settings: ObsidianTtsSettings) {
		this.settings = settings;
		this.baiduProvider = new BaiduProvider(settings.baidu);
	}

	updateSettings(settings: ObsidianTtsSettings): void {
		this.settings = settings;
		this.baiduProvider.updateConfig(settings.baidu);
	}

	getActiveProvider(): TTSProvider {
		return this.getProvider(this.settings.activeProvider);
	}

	getProvider(id: ObsidianTtsSettings["activeProvider"]): TTSProvider {
		const s = this.settings;
		switch (id) {
			case "edge":
				return new EdgeProvider(s.edge, s.showNotices);
			case "openai":
				return new OpenAIProvider({
					apiKey: s.openai.apiKey,
					baseUrl: "https://api.openai.com/v1",
					model: s.openai.model,
					defaultVoice: s.openai.voice,
				});
			case "openai-compatible":
				return new OpenAIProvider({
					apiKey: s.openaiCompatible.apiKey || "not-needed",
					baseUrl: s.openaiCompatible.baseUrl.replace(/\/$/, ""),
					model: s.openaiCompatible.model,
					defaultVoice: s.openaiCompatible.voice,
				});
			case "azure":
				return new AzureProvider(s.azure);
			case "google":
				return new GoogleProvider(s.google);
			case "elevenlabs":
				return new ElevenLabsProvider(s.elevenlabs);
			case "zhipu":
				return new ZhipuProvider(s.zhipu);
			case "baidu":
				return this.baiduProvider;
			default:
				return new EdgeProvider(s.edge, s.showNotices);
		}
	}
}
