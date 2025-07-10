import { WebSocket as WebSocketWS } from 'ws';

export interface Options {
	url: URL;
	headers?: Headers;
}

/**
 * Create a new WebSocket connection on the server using either the native WebSocket or the ws package.
 * @param options - The options for the WebSocket connection
 * @returns The WebSocket connection
 */
export function createWebsocket(options: Options) {
	if (options.headers) {
		if (globalThis.process) {
			const headers_object = Object.fromEntries(options.headers.entries());

			// in Bun, WebSocket  constructor supports headers
			if (globalThis.process.versions.bun) {
				return new globalThis.WebSocket(
					options.url,
					{
						headers: headers_object,
					},
				);
			}

			// in other server-side environments, use ws package
			return new WebSocketWS(
				options.url,
				{
					headers: headers_object,
				},
			);
		}

		// eslint-disable-next-line no-console
		console.warn('[@extws/client] Headers are not supported while using WebSocket in browser. They will be ignored.');
	}

	if (globalThis.WebSocket) {
		return new globalThis.WebSocket(options.url);
	}

	return new WebSocketWS(options.url);
}

export type LocalWebSocketType = ReturnType<typeof createWebsocket>;
