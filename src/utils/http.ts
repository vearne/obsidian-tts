import { requestUrl, RequestUrlParam, RequestUrlResponse } from "obsidian";
import { formatError, logError, logRequest, logResponse } from "./logger";

export async function loggedRequest(
	provider: string,
	params: RequestUrlParam,
	bodyPreview?: string
): Promise<RequestUrlResponse> {
	logRequest({
		provider,
		method: params.method ?? "GET",
		url: params.url,
		headers: params.headers as Record<string, string> | undefined,
		bodyPreview,
	});

	try {
		const response = await requestUrl({ ...params, throw: false });
		const contentType =
			response.headers?.["content-type"] ??
			response.headers?.["Content-Type"] ??
			"";

		if (response.status >= 400) {
			logResponse(provider, response.status, {
				contentType,
				bodyPreview: response.text?.slice(0, 500),
			});
		} else {
			let byteLength: number | undefined;
			try {
				byteLength = response.arrayBuffer.byteLength;
			} catch {
				byteLength = undefined;
			}
			logResponse(provider, response.status, {
				contentType,
				byteLength,
			});
		}

		return response;
	} catch (err) {
		logError(`[${provider}] requestUrl 异常`, err);
		throw new Error(`${provider} 网络请求失败: ${formatError(err)}`);
	}
}
