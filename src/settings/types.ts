export type ProviderId =
	| "edge"
	| "openai"
	| "openai-compatible"
	| "azure"
	| "google"
	| "elevenlabs"
	| "zhipu"
	| "baidu"
	| "aliyun";

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

	aliyun: {
		apiKey: string;
		model: string;
		voice: string;
		format: "mp3" | "wav" | "pcm" | "opus";
		sampleRate: number;
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

	aliyun: {
		apiKey: "",
		model: "cosyvoice-v3-flash",
		voice: "longanyang",
		format: "mp3",
		sampleRate: 24000,
		volume: 50,
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
	aliyun: "阿里云 CosyVoice",
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

export const ALIYUN_VOICES: { id: string; label: string }[] = [
	{ id: "longanyang", label: "龙安洋（阳光大男孩）" },
	{ id: "longanhuan_v3", label: "龙安欢（欢脱元气女）" },
	{ id: "longhuhu_v3", label: "龙呼呼（天真烂漫女童）" },
	{ id: "longjielidou_v3", label: "龙杰力豆（阳光顽皮男童）" },
	{ id: "longxian_v3", label: "龙仙（豪放可爱女）" },
	{ id: "longshanshan_v3", label: "龙闪闪（戏剧化童声）" },
	{ id: "longjiaxin_v3", label: "龙嘉欣（优雅粤语女）" },
	{ id: "longanyue_v3", label: "龙安粤（欢脱粤语男）" },
	{ id: "longlaotie_v3", label: "龙老铁（东北直率男）" },
	{ id: "longshange_v3", label: "龙陕哥（原味陕北男）" },
	{ id: "longfei_v3", label: "龙飞（热血磁性男）" },
	{ id: "longyingxiao_v3", label: "龙应笑（清甜推销女）" },
	{ id: "longyingxun_v3", label: "龙应询（年轻青涩男）" },
	{ id: "longyingjing_v3", label: "龙应静（低调冷静女）" },
	{ id: "longyingling_v3", label: "龙应聆（温和共情女）" },
	{ id: "longxiaochun_v3", label: "龙小淳（知性积极女）" },
	{ id: "longxiaoxia_v3", label: "龙小夏（沉稳权威女）" },
	{ id: "longyumi_v3", label: "YUMI（正经青年女）" },
	{ id: "longanyun_v3", label: "龙安昀（居家暖男）" },
	{ id: "longanwen_v3", label: "龙安温（优雅知性女）" },
	{ id: "longanli_v3", label: "龙安莉（利落从容女）" },
	{ id: "longanlang_v3", label: "龙安朗（清爽利落男）" },
	{ id: "longantai_v3", label: "龙安台（嗲甜台湾女）" },
	{ id: "longhua_v3", label: "龙华（元气甜美女）" },
	{ id: "longcheng_v3", label: "龙橙（智慧青年男）" },
	{ id: "longze_v3", label: "龙泽（温暖元气男）" },
	{ id: "longzhe_v3", label: "龙哲（呆板大暖男）" },
	{ id: "longyan_v3", label: "龙颜（温暖春风女）" },
	{ id: "longxing_v3", label: "龙星（温婉邻家女）" },
	{ id: "longtian_v3", label: "龙天（磁性理智男）" },
	{ id: "longwan_v3", label: "龙婉（细腻柔声女）" },
	{ id: "longfeifei_v3", label: "龙菲菲（甜美娇气女）" },
	{ id: "longhao_v3", label: "龙浩（多情忧郁男）" },
	{ id: "longanrou_v3", label: "龙安柔（温柔闺蜜女）" },
	{ id: "longhan_v3", label: "龙寒（温暖痴情男）" },
	{ id: "longanzhi_v3", label: "龙安智（睿智轻熟男）" },
	{ id: "longmiao_v3", label: "龙妙（抑扬顿挫女）" },
	{ id: "longsanshu_v3", label: "龙三叔（沉稳质感男）" },
	{ id: "longyuan_v3", label: "龙媛（温暖治愈女）" },
	{ id: "longyue_v3", label: "龙悦（温暖磁性女）" },
	{ id: "longxiu_v3", label: "龙修（博才说书男）" },
	{ id: "longnan_v3", label: "龙楠（睿智青年男）" },
	{ id: "longshuo_v3", label: "龙硕（博才干练男）" },
	{ id: "longshu_v3", label: "龙书（沉稳青年男）" },
	{ id: "loongbella_v3", label: "Bella3.0（精准干练女）" },
];
