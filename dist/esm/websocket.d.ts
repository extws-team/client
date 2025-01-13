export interface Options {
    url: URL;
    headers?: Record<string, string>;
}
/**
 * Create a new WebSocket connection on the server using either the native WebSocket or the ws package.
 * @param options - The options for the WebSocket connection
 * @returns The WebSocket connection
 */
export declare function createWebsocket(options: Options): import("ws") | WebSocket;
export type LocalWebSocketType = ReturnType<typeof createWebsocket>;
