import type { TextFilteringSettings } from "../settings/types";

export function filterFrontmatter(text: string, enabled: boolean): string {
	if (!enabled) return text;
	return text.replace(/^(---|\.\.\.)[\s\S]*?\1\n?/, "").trim();
}

export function preprocessText(
	text: string,
	filtering: TextFilteringSettings
): string {
	let result = filterFrontmatter(text, filtering.filterFrontmatter);

	if (filtering.filterCodeBlocks) {
		result = result.replace(/```[\s\S]*?```/g, "");
		result = result.replace(/~~~[\s\S]*?~~~/g, "");
	}
	if (filtering.filterInlineCode) {
		result = result.replace(/`[^`]+`/g, "");
	}
	if (filtering.filterHtmlTags) {
		result = result.replace(/<[^>]+>/g, "");
	}
	if (filtering.filterImages) {
		result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
		result = result.replace(/!\[\[[^\]]+\]\]/g, "");
	}
	if (filtering.filterWikiLinks) {
		result = result.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1");
	}
	if (filtering.filterMarkdownLinks) {
		result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
	}
	if (filtering.filterCallouts) {
		result = result.replace(/^>\s?\[!?\w*\][+-]?\s.*$/gm, "");
		result = result.replace(/^>\s?/gm, "");
	}
	result = result
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/__([^_]+)__/g, "$1")
		.replace(/_([^_]+)_/g, "$1")
		.replace(/~~([^~]+)~~/g, "$1")
		.replace(/\[\^[^\]]+\]/g, "")
		.replace(/^[-*+]\s+/gm, "")
		.replace(/^\d+\.\s+/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	return result;
}
