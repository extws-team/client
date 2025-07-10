import { PayloadType, buildPayload, parsePayload } from "@extws/server/dev";
import { NeoEventTarget } from "neoevents";
import { WebSocket } from "ws";

//#region src/websocket.ts
/**
* Create a new WebSocket connection on the server using either the native WebSocket or the ws package.
* @param options - The options for the WebSocket connection
* @returns The WebSocket connection
*/
function createWebsocket(options) {
	if (options.headers) {
		if (globalThis.process) {
			const headers_object = Object.fromEntries(options.headers.entries());
			if (globalThis.process.versions.bun) return new globalThis.WebSocket(options.url, { headers: headers_object });
			return new WebSocket(options.url, { headers: headers_object });
		}
		console.warn("[@extws/client] Headers are not supported while using WebSocket in browser. They will be ignored.");
	}
	if (globalThis.WebSocket) return new globalThis.WebSocket(options.url);
	return new WebSocket(options.url);
}

//#endregion
//#region src/main.ts
const BROKEN_STATES = new Set([2, 3]);
/**
* I
* @param value - The value to check
* @returns -Whether the value is a plain object
*/
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && value.constructor === Object;
}
var ExtWSClient = class extends NeoEventTarget {
	websocket = null;
	websocket_state = null;
	url;
	headers = new Headers();
	options = {
		connect: true,
		reconnect: true,
		reconnect_interval: 2e3,
		ping_timeout: 5e3
	};
	timeouts = {};
	constructor(url, options) {
		super();
		this.url = url;
		if (options) this.options = {
			...this.options,
			...options
		};
		if (this.options.connect === true) setTimeout(() => this.connect());
		this.on("disconnect", () => {
			this.websocket = null;
			this.websocket_state = null;
			if (this.options.reconnect === true) {
				clearTimeout(this.timeouts.reconnect);
				this.timeouts.reconnect = setTimeout(() => this.connect(), this.options.reconnect_interval);
			}
		});
	}
	get is_connected() {
		return this.websocket !== null && BROKEN_STATES.has(this.websocket.readyState) !== true && typeof this.id === "string" && Date.now() - this.websocket_state.ts_last_message < this.websocket_state.idle_timeout;
	}
	get id() {
		return this.websocket_state?.socket_id ?? null;
	}
	createPing() {
		clearTimeout(this.timeouts.ping);
		if (this.websocket) this.timeouts.ping = setTimeout(() => this.sendPing(), this.websocket_state.idle_timeout - this.options.ping_timeout);
	}
	sendPing() {
		clearTimeout(this.timeouts.dead);
		if (this.is_connected) {
			this.websocket?.send(buildPayload(PayloadType.PING));
			this.timeouts.dead = setTimeout(() => this.disconnect(), this.options.ping_timeout * 1e3);
		}
	}
	connect() {
		if (this.is_connected) return;
		if (this.websocket) this.websocket.close();
		this.emit("beforeconnect");
		const ws = createWebsocket({
			url: this.url,
			headers: this.headers
		});
		this.websocket = ws;
		this.websocket_state = {
			socket_id: null,
			idle_timeout: 6e4,
			ts_last_message: 0
		};
		ws.addEventListener("error", (error) => {
			console.error(error);
		});
		ws.addEventListener("open", () => {
			if (ws === this.websocket) {
				this.websocket_state.ts_last_message = Date.now();
				this.createPing();
			}
		});
		ws.addEventListener("message", (event) => {
			if (ws !== this.websocket) return;
			clearTimeout(this.timeouts.dead);
			this.createPing();
			this.websocket_state.ts_last_message = Date.now();
			const { payload_type, data, event_type } = parsePayload(event.data);
			switch (payload_type) {
				case PayloadType.INIT:
					if (!isPlainObject(data) || typeof data.id !== "string" || typeof data.idle_timeout !== "number") throw new TypeError("Invalid data received.");
					this.websocket_state.socket_id = data.id;
					this.websocket_state.idle_timeout = data.idle_timeout * 1e3;
					this.emit("connect");
					break;
				case PayloadType.PING:
					ws.send(buildPayload(PayloadType.PONG));
					break;
				case PayloadType.MESSAGE:
					this.emit(event_type ?? "message", data);
					break;
			}
		});
		ws.addEventListener("close", () => {
			if (ws === this.websocket) {
				this.websocket_state.ts_last_message = 0;
				this.emit("disconnect");
			}
		});
	}
	disconnect() {
		clearTimeout(this.timeouts.reconnect);
		this.websocket?.close();
	}
	send(event_type, data) {
		if (this.is_connected) this.websocket?.send(buildPayload(PayloadType.MESSAGE, event_type, data));
	}
};

//#endregion
export { ExtWSClient };