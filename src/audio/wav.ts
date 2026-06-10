export type PlayableAudioFormat = "mp3" | "wav";

export function detectAudioFormat(buffer: ArrayBuffer): PlayableAudioFormat {
	if (buffer.byteLength < 4) {
		return "mp3";
	}
	const bytes = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
	if (
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46
	) {
		return "wav";
	}
	return "mp3";
}

/** 将原始 PCM 封装为浏览器可播放的 WAV（智谱 GLM-TTS 默认 24kHz / 16bit / mono） */
export function pcmToWav(
	pcm: ArrayBuffer,
	sampleRate = 24000,
	numChannels = 1,
	bitsPerSample = 16
): ArrayBuffer {
	const dataLength = pcm.byteLength;
	const buffer = new ArrayBuffer(44 + dataLength);
	const view = new DataView(buffer);

	const writeString = (offset: number, str: string) => {
		for (let i = 0; i < str.length; i++) {
			view.setUint8(offset + i, str.charCodeAt(i));
		}
	};

	writeString(0, "RIFF");
	view.setUint32(4, 36 + dataLength, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true);
	view.setUint16(32, (numChannels * bitsPerSample) / 8, true);
	view.setUint16(34, bitsPerSample, true);
	writeString(36, "data");
	view.setUint32(40, dataLength, true);
	new Uint8Array(buffer, 44).set(new Uint8Array(pcm));
	return buffer;
}

export function isPcmContentType(contentType: string): boolean {
	return contentType.toLowerCase().includes("audio/pcm");
}
