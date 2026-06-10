import { App, Editor, MarkdownView, Notice, Platform, TFile } from "obsidian";
import { concatArrayBuffers } from "../tts/provider";

export async function exportMp3ToVault(
	app: App,
	buffers: ArrayBuffer[],
	fileName: string,
	outputFolder: string
): Promise<string> {
	const merged = concatArrayBuffers(buffers);
	const folder = outputFolder.replace(/^\/|\/$/g, "");
	const folderExists = await app.vault.adapter.exists(folder);
	if (!folderExists) {
		await app.vault.createFolder(folder);
	}
	const path = `${folder}/${fileName}.mp3`;
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.modifyBinary(existing, merged);
	} else {
		await app.vault.createBinary(path, merged);
	}
	return path;
}

export async function embedMp3InNote(
	editor: Editor,
	vaultPath: string
): Promise<void> {
	const link = `![[${vaultPath}]]`;
	const cursor = editor.getCursor();
	editor.replaceRange(`\n${link}\n`, cursor);
}

export function getAudioFormat(
	settingsProvider: string,
	zhipuFormat?: string,
	aliyunFormat?: string,
	openaiCompatibleFormat?: string
): "mp3" | "wav" {
	if (settingsProvider === "zhipu" && zhipuFormat === "wav") {
		return "wav";
	}
	if (settingsProvider === "aliyun" && aliyunFormat === "wav") {
		return "wav";
	}
	if (settingsProvider === "openai-compatible") {
		if (openaiCompatibleFormat === "wav" || openaiCompatibleFormat === "pcm") {
			return "wav";
		}
	}
	return "mp3";
}

export function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

export function showExportNotice(enabled: boolean, path: string): void {
	if (enabled) {
		new Notice(`MP3 已导出: ${path}`, 5000);
	}
}

export function isDesktopExportAvailable(): boolean {
	return !Platform.isMobile;
}

export function getNoteTitle(file: TFile | null, fallback = "note"): string {
	return file?.basename ?? fallback;
}
