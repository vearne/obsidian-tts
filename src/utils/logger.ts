const LOG_PREFIX = "[obsidian-tts]";

let debugEnabled = true;

export function setDebugEnabled(enabled: boolean): void {
	debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
	return debugEnabled;
}

/** 将任意 thrown 值转为可读字符串（修复 [object Object]） */
export function formatError(err: unknown): string {
	if (err instanceof Error) {
		const cause = (err as Error & { cause?: unknown }).cause;
		const extra = cause !== undefined ? ` | cause: ${formatError(cause)}` : "";
		return `${err.message}${extra}`;
	}
	if (typeof err === "string") return err;
	if (err === null || err === undefined) return String(err);
	if (typeof err === "object") {
		const obj = err as Record<string, unknown>;
		if (typeof obj.message === "string") {
			return obj.message;
		}
		try {
			return JSON.stringify(err, null, 2);
		} catch {
			return String(err);
		}
	}
	return String(err);
}

export function maskSecret(value: string, head = 6, tail = 2): string {
	if (!value) return "(未配置)";
	if (value.length <= head + tail) return "***";
	return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function logInfo(message: string, data?: unknown): void {
	if (!debugEnabled) return;
	if (data !== undefined) {
		console.log(`${LOG_PREFIX} ${message}`, data);
	} else {
		console.log(`${LOG_PREFIX} ${message}`);
	}
}

export function logWarn(message: string, data?: unknown): void {
	if (data !== undefined) {
		console.warn(`${LOG_PREFIX} ${message}`, data);
	} else {
		console.warn(`${LOG_PREFIX} ${message}`);
	}
}

export function logError(message: string, err?: unknown): void {
	if (err !== undefined) {
		console.error(`${LOG_PREFIX} ${message}`, err);
		console.error(`${LOG_PREFIX} 详情: ${formatError(err)}`);
	} else {
		console.error(`${LOG_PREFIX} ${message}`);
	}
}

export interface RequestLogInfo {
	provider: string;
	method: string;
	url: string;
	headers?: Record<string, string>;
	bodyPreview?: string;
}

function sanitizeUrl(url: string): string {
	try {
		const parsed = new URL(url);
		for (const key of ["key", "client_id", "client_secret", "tok"]) {
			const value = parsed.searchParams.get(key);
			if (value) {
				parsed.searchParams.set(key, maskSecret(value));
			}
		}
		return parsed.toString();
	} catch {
		return url;
	}
}

export function logRequest(info: RequestLogInfo): void {
	if (!debugEnabled) return;
	const safeHeaders = info.headers ? { ...info.headers } : undefined;
	if (safeHeaders?.Authorization) {
		const token = safeHeaders.Authorization.replace(/^Bearer\s+/i, "");
		safeHeaders.Authorization = `Bearer ${maskSecret(token)}`;
	}
	if (safeHeaders?.["Ocp-Apim-Subscription-Key"]) {
		safeHeaders["Ocp-Apim-Subscription-Key"] = maskSecret(
			safeHeaders["Ocp-Apim-Subscription-Key"]
		);
	}
	if (safeHeaders?.["xi-api-key"]) {
		safeHeaders["xi-api-key"] = maskSecret(safeHeaders["xi-api-key"]);
	}
	logInfo(`[${info.provider}] → ${info.method} ${sanitizeUrl(info.url)}`, {
		headers: safeHeaders,
		bodyPreview: info.bodyPreview?.slice(0, 300),
	});
}

export function logResponse(
	provider: string,
	status: number,
	detail: {
		contentType?: string;
		bodyPreview?: string;
		byteLength?: number;
	}
): void {
	if (!debugEnabled) return;
	logInfo(`[${provider}] ← HTTP ${status}`, detail);
}
