"use strict";
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
const __extws_server_dev = __toESM(require("@extws/server/dev"));
const neoevents = __toESM(require("neoevents"));
const ws = __toESM(require("ws"));

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
			return new ws.WebSocket(options.url, { headers: headers_object });
		}
		console.warn("[@extws/client] Headers are not supported while using WebSocket in browser. They will be ignored.");
	}
	if (globalThis.WebSocket) return new globalThis.WebSocket(options.url);
	return new ws.WebSocket(options.url);
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
var ExtWSClient = class extends neoevents.NeoEventTarget {
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
			this.websocket?.send((0, __extws_server_dev.buildPayload)(__extws_server_dev.PayloadType.PING));
			this.timeouts.dead = setTimeout(() => this.disconnect(), this.options.ping_timeout * 1e3);
		}
	}
	connect() {
		if (this.is_connected) return;
		if (this.websocket) this.websocket.close();
		this.emit("beforeconnect");
		const ws$1 = createWebsocket({
			url: this.url,
			headers: this.headers
		});
		this.websocket = ws$1;
		this.websocket_state = {
			socket_id: null,
			idle_timeout: 6e4,
			ts_last_message: 0
		};
		ws$1.addEventListener("error", (error) => {
			console.error(error);
		});
		ws$1.addEventListener("open", () => {
			if (ws$1 === this.websocket) {
				this.websocket_state.ts_last_message = Date.now();
				this.createPing();
			}
		});
		ws$1.addEventListener("message", (event) => {
			if (ws$1 !== this.websocket) return;
			clearTimeout(this.timeouts.dead);
			this.createPing();
			this.websocket_state.ts_last_message = Date.now();
			const { payload_type, data, event_type } = (0, __extws_server_dev.parsePayload)(event.data);
			switch (payload_type) {
				case __extws_server_dev.PayloadType.INIT:
					if (!isPlainObject(data) || typeof data.id !== "string" || typeof data.idle_timeout !== "number") throw new TypeError("Invalid data received.");
					this.websocket_state.socket_id = data.id;
					this.websocket_state.idle_timeout = data.idle_timeout * 1e3;
					this.emit("connect");
					break;
				case __extws_server_dev.PayloadType.PING:
					ws$1.send((0, __extws_server_dev.buildPayload)(__extws_server_dev.PayloadType.PONG));
					break;
				case __extws_server_dev.PayloadType.MESSAGE:
					this.emit(event_type ?? "message", data);
					break;
			}
		});
		ws$1.addEventListener("close", () => {
			if (ws$1 === this.websocket) {
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
		if (this.is_connected) this.websocket?.send((0, __extws_server_dev.buildPayload)(__extws_server_dev.PayloadType.MESSAGE, event_type, data));
	}
};

//#endregion
exports.ExtWSClient = ExtWSClient