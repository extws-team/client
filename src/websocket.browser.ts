import type { Options } from './websocket.js';

/**
 * Create a new WebSocket connection in the browser.
 * @param options - The options for the WebSocket connection
 * @returns The WebSocket connection
 */
export function createWebsocket(options: Options): WebSocket {
	if (Object.keys(options.headers || {}).length > 0) {
		// eslint-disable-next-line no-console
		console.warn('[@extws/client] Headers are not supported while using WebSocket in browser. They will be ignored.');
	}

	return new WebSocket(options.url);
}
