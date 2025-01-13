import { WebSocket as WebSocketWS } from 'ws';
/**
 * Create a new WebSocket connection on the server using either the native WebSocket or the ws package.
 * @param options - The options for the WebSocket connection
 * @returns The WebSocket connection
 */
export function createWebsocket(options) {
    if (Object.keys(options.headers || {}).length > 0) {
        // in Bun, WebSocket  constructor supports  headers
        if (globalThis.Bun) {
            return new globalThis.WebSocket(options.url, {
                // @ts-expect-error Bun's Websocket supports headers
                headers: options.headers,
            });
        }
        // in other server-side environments, use ws package
        if (globalThis.process) {
            return new WebSocketWS(options.url, {
                headers: options.headers,
            });
        }
        // eslint-disable-next-line no-console
        console.warn('[@extws/client] Headers are not supported while using WebSocket in browser. They will be ignored.');
    }
    return new globalThis.WebSocket(options.url);
}
