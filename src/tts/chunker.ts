const SENTENCE_END = /[。！？.!?；;]\s*/;
const PARAGRAPH_END = /\n\n+/;

export function chunkText(text: string, maxSize: number): string[] {
	if (!text.trim()) return [];

	if (text.length <= maxSize) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > 0) {
		if (remaining.length <= maxSize) {
			chunks.push(remaining.trim());
			break;
		}

		let splitAt = findSplitPoint(remaining, maxSize);
		if (splitAt <= 0) splitAt = maxSize;

		const chunk = remaining.slice(0, splitAt).trim();
		if (chunk) chunks.push(chunk);
		remaining = remaining.slice(splitAt).trimStart();
	}

	return chunks.filter((c) => c.length > 0);
}

function findSplitPoint(text: string, maxSize: number): number {
	const window = text.slice(0, maxSize);

	const paragraphMatch = window.match(PARAGRAPH_END);
	if (paragraphMatch && paragraphMatch.index !== undefined) {
		return paragraphMatch.index + paragraphMatch[0].length;
	}

	for (let i = window.length - 1; i >= Math.floor(maxSize * 0.5); i--) {
		if (SENTENCE_END.test(window.charAt(i))) {
			return i + 1;
		}
	}

	const spaceIdx = window.lastIndexOf(" ");
	if (spaceIdx > maxSize * 0.5) return spaceIdx + 1;

	const cnComma = window.lastIndexOf("，");
	if (cnComma > maxSize * 0.5) return cnComma + 1;

	return maxSize;
}
