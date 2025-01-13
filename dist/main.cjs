var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/main.ts
var exports_main = {};
__export(exports_main, {
  ExtWSClient: () => ExtWSClient
});
module.exports = __toCommonJS(exports_main);
var import_dev = require("@extws/server/dev");
var import_neoevents = require("neoevents");

// src/websocket.ts
var import_ws = require("ws");
function createWebsocket(options) {
  if (Object.keys(options.headers || {}).length > 0) {
    if (globalThis.Bun) {
      return new globalThis.WebSocket(options.url, {
        headers: options.headers
      });
    }
    if (globalThis.process) {
      return new import_ws.WebSocket(options.url, {
        headers: options.headers
      });
    }
    console.warn("[@extws/client] Headers are not supported while using WebSocket in browser. They will be ignored.");
  }
  return new globalThis.WebSocket(options.url);
}

// src/main.ts
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && value.constructor === Object;
}
var BROKEN_STATES = new Set([
  2,
  3
]);

class ExtWSClient extends import_neoevents.NeoEventTarget {
  websocket = null;
  websocket_state = null;
  url;
  headers = {};
  options = {
    connect: true,
    reconnect: true,
    reconnect_interval: 2000,
    ping_timeout: 5000
  };
  timeouts = {};
  constructor(url, options) {
    super();
    this.url = url;
    if (options) {
      this.options = {
        ...this.options,
        ...options
      };
    }
    if (this.options.connect === true) {
      setTimeout(() => this.connect());
    }
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
    if (this.websocket) {
      this.timeouts.ping = setTimeout(() => this.sendPing(), this.websocket_state.idle_timeout - this.options.ping_timeout);
    }
  }
  sendPing() {
    clearTimeout(this.timeouts.dead);
    if (this.is_connected) {
      this.websocket?.send(import_dev.buildPayload(import_dev.PayloadType.PING));
      this.timeouts.dead = setTimeout(() => this.disconnect(), this.options.ping_timeout * 1000);
    }
  }
  connect() {
    if (this.is_connected) {
      return;
    }
    if (this.websocket) {
      this.websocket.close();
    }
    this.emit("beforeconnect");
    const ws = createWebsocket({
      url: this.url,
      headers: this.headers
    });
    this.websocket = ws;
    this.websocket_state = {
      socket_id: null,
      idle_timeout: 60000,
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
      if (ws !== this.websocket) {
        return;
      }
      clearTimeout(this.timeouts.dead);
      this.createPing();
      this.websocket_state.ts_last_message = Date.now();
      const {
        payload_type,
        data,
        event_type
      } = import_dev.parsePayload(event.data);
      switch (payload_type) {
        case import_dev.PayloadType.INIT:
          if (!isPlainObject(data) || typeof data.id !== "string" || typeof data.idle_timeout !== "number") {
            throw new TypeError("Invalid data received.");
          }
          this.websocket_state.socket_id = data.id;
          this.websocket_state.idle_timeout = data.idle_timeout * 1000;
          this.emit("connect");
          break;
        case import_dev.PayloadType.PING:
          ws.send(import_dev.buildPayload(import_dev.PayloadType.PONG));
          break;
        case import_dev.PayloadType.MESSAGE:
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
    if (this.is_connected) {
      this.websocket?.send(import_dev.buildPayload(import_dev.PayloadType.MESSAGE, event_type, data));
    }
  }
}
