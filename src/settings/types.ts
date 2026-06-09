export type ProviderId =
	| "edge"
	| "openai"
	| "openai-compatible"
	| "azure"
	| "google"
	| "elevenlabs"
	| "zhipu"
	| "baidu";

export type EdgeConnectionMode = "auto" | "direct" | "proxy";

export interface TextFilteringSettings {
	filterFrontmatter: boolean;
	filterMarkdownLinks: boolean;
	filterCodeBlocks: boolean;
	filterInlineCode: boolean;
	filterHtmlTags: boolean;
	filterImages: boolean;
	filterWikiLinks: boolean;
	filterCallouts: boolean;
}

export interface ObsidianTtsSettings {
	activeProvider: ProviderId;
	playbackSpeed: number;
	showNotices: boolean;
	enableDebugLog: boolean;
	showStatusBarButton: boolean;
	showMenuItems: boolean;
	enableQueueFeature: boolean;
	disableFloatingPlayer: boolean;
	floatingPlayerPosition: { x: number; y: number } | null;

	textFiltering: TextFilteringSettings;

	edge: {
		voice: string;
		connectionMode: EdgeConnectionMode;
		proxyUrl: string;
	};

	openai: {
		apiKey: string;
		model: string;
		voice: string;
	};

	openaiCompatible: {
		apiKey: string;
		baseUrl: string;
		model: string;
		voice: string;
	};

	azure: {
		apiKey: string;
		region: string;
		voice: string;
	};

	google: {
		apiKey: string;
		languageCode: string;
		voiceName: string;
	};

	elevenlabs: {
		apiKey: string;
		voiceId: string;
		modelId: string;
	};

	zhipu: {
		apiKey: string;
		voice: string;
		speed: number;
		volume: number;
		responseFormat: "wav" | "pcm";
	};

	baidu: {
		apiKey: string;
		secretKey: string;
		voice: number;
		speed: number;
		pitch: number;
		volume: number;
	};

	mp3Export: {
		enabled: boolean;
		outputFolder: string;
		embedInNote: boolean;
	};
}

export const DEFAULT_SETTINGS: ObsidianTtsSettings = {
	activeProvider: "edge",
	playbackSpeed: 1.0,
	showNotices: true,
	enableDebugLog: true,
	showStatusBarButton: true,
	showMenuItems: true,
	enableQueueFeature: true,
	disableFloatingPlayer: false,
	floatingPlayerPosition: null,

	textFiltering: {
		filterFrontmatter: true,
		filterMarkdownLinks: true,
		filterCodeBlocks: true,
		filterInlineCode: true,
		filterHtmlTags: true,
		filterImages: true,
		filterWikiLinks: true,
		filterCallouts: true,
	},

	edge: {
		voice: "zh-CN-XiaoxiaoNeural",
		connectionMode: "auto",
		proxyUrl: "",
	},

	openai: {
		apiKey: "",
		model: "tts-1",
		voice: "alloy",
	},

	openaiCompatible: {
		apiKey: "",
		baseUrl: "http://localhost:5050/v1",
		model: "tts-1",
		voice: "zh-CN-XiaoxiaoNeural",
	},

	azure: {
		apiKey: "",
		region: "eastasia",
		voice: "zh-CN-XiaoxiaoNeural",
	},

	google: {
		apiKey: "",
		languageCode: "cmn-CN",
		voiceName: "cmn-CN-Wavenet-A",
	},

	elevenlabs: {
		apiKey: "",
		voiceId: "21m00Tcm4TlvDq8ikWAM",
		modelId: "eleven_multilingual_v2",
	},

	zhipu: {
		apiKey: "",
		voice: "tongtong",
		speed: 1.0,
		volume: 1.0,
		responseFormat: "wav",
	},

	baidu: {
		apiKey: "",
		secretKey: "",
		voice: 0,
		speed: 5,
		pitch: 5,
		volume: 5,
	},

	mp3Export: {
		enabled: true,
		outputFolder: "TTS",
		embedInNote: true,
	},
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
	edge: "Edge TTS",
	openai: "OpenAI TTS",
	"openai-compatible": "OpenAI 兼容 API",
	azure: "Azure Speech",
	google: "Google Cloud TTS",
	elevenlabs: "ElevenLabs",
	zhipu: "智谱 GLM-TTS",
	baidu: "百度智能云 TTS",
};

export const EDGE_VOICES = [
	"zh-CN-XiaoxiaoNeural",
	"zh-CN-YunxiNeural",
	"zh-CN-YunyangNeural",
	"en-US-AvaNeural",
	"en-US-AndrewNeural",
];

export const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

/** 官方文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts */
export const ZHIPU_VOICES: { id: string; label: string }[] = [
	{ id: "tongtong", label: "彤彤（默认）" },
	{ id: "xiaochen", label: "小陈" },
	{ id: "chuichui", label: "锤锤" },
	{ id: "jam", label: "jam" },
	{ id: "kazi", label: "kazi" },
	{ id: "douji", label: "douji" },
	{ id: "luodo", label: "luodo" },
];

export const ZHIPU_MAX_INPUT_CHARS = 1024;

export const BAIDU_VOICES: { id: number; label: string }[] = [
	{ id: 0, label: "度小美" },
	{ id: 1, label: "度小宇" },
	{ id: 3, label: "度逍遥" },
	{ id: 4, label: "度丫丫" },
	{ id: 5003, label: "度逍遥(精品)" },
	{ id: 5118, label: "度小鹿" },
];
