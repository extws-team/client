// node_modules/@extws/server/dist/esm/consts.js
var IDLE_TIMEOUT = 60;
var TIMEFRAME_PING_DISCONNECT = 5;
var IDLE_TIMEOUT_DISCONNECT_MS = IDLE_TIMEOUT * 1000;
var TIMEFRAME_PING_DISCONNECT_MS = TIMEFRAME_PING_DISCONNECT * 1000;
var IDLE_TIMEOUT_PING_MS = IDLE_TIMEOUT_DISCONNECT_MS - TIMEFRAME_PING_DISCONNECT_MS;
// node_modules/@extws/server/dist/esm/payload/types.js
var PayloadType;
(function(PayloadType2) {
  PayloadType2[PayloadType2["ERROR"] = -1] = "ERROR";
  PayloadType2[PayloadType2["INIT"] = 1] = "INIT";
  PayloadType2[PayloadType2["PING"] = 2] = "PING";
  PayloadType2[PayloadType2["PONG"] = 3] = "PONG";
  PayloadType2[PayloadType2["MESSAGE"] = 4] = "MESSAGE";
})(PayloadType || (PayloadType = {}));

// node_modules/@extws/server/dist/esm/payload/json.js
function buildPayload(payload_type, argument1, argument2) {
  let payload = String(payload_type);
  let event_type;
  let data;
  if (argument2 === undefined && typeof argument1 !== "string") {
    data = argument1;
    event_type = undefined;
  } else if (typeof argument1 === "string") {
    data = argument2;
    event_type = argument1;
  }
  if (event_type) {
    payload += event_type;
  }
  if (data) {
    payload += JSON.stringify(data);
  }
  return payload;
}
function isTypedArray(value) {
  return value instanceof Int8Array || value instanceof Int16Array || value instanceof Int32Array || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Uint16Array || value instanceof Uint32Array || value instanceof Float32Array || value instanceof Float64Array || value instanceof BigInt64Array;
}
function parsePayload(payload) {
  if (typeof payload === "string") {
  } else if (payload instanceof ArrayBuffer || isTypedArray(payload)) {
    payload = textDecoder.decode(payload);
  } else if (Array.isArray(payload)) {
    payload = Buffer.concat(payload).toString();
  } else {
    throw new TypeError("Invalid payload type.");
  }
  const result = {
    payload_type: (payload.codePointAt(0) ?? 48) - 48
  };
  let start = 1;
  let event_type = "";
  for (let index = start;index < payload.length && JSON_START.has(payload[index]) === false; index++) {
    event_type += payload[index];
    start++;
  }
  if (event_type.length > 31) {
    if (PRINT_ERRORS) {
      console.error(`Event type cannot be longer than 31 characters, received "${event_type}"`);
    }
    return {
      payload_type: PayloadType.ERROR
    };
  }
  if (event_type.length > 0) {
    result.event_type = event_type;
  }
  if (start < payload.length) {
    const payload_raw = payload.slice(start);
    try {
      result.data = JSON.parse(payload_raw);
    } catch {
      if (PRINT_ERRORS) {
        console.error(`Cannot parse payload "${payload_raw}": invalid JSON`);
      }
      return {
        payload_type: PayloadType.ERROR
      };
    }
  }
  return result;
}
var PRINT_ERRORS = true;
var JSON_START = new Set(["[", "{"]);
var textDecoder = new TextDecoder;
// node_modules/@extws/server/dist/esm/payload/outcome-event.js
var OutcomePayloadEventType;
(function(OutcomePayloadEventType2) {
  OutcomePayloadEventType2["SOCKET"] = "p.socket";
  OutcomePayloadEventType2["GROUP"] = "p.group";
  OutcomePayloadEventType2["BROADCAST"] = "p.broadcast";
})(OutcomePayloadEventType || (OutcomePayloadEventType = {}));
// node_modules/neoevents/dist/esm/main.js
class m extends Event {
  h;
  constructor(g, h) {
    super(g);
    this.detail = h;
  }
}

class q extends EventTarget {
  listeners = new Set;
  addListener(g, h, j) {
    this.addEventListener(g, h, j);
    let k = () => {
      this.removeEventListener(g, h, j), this.listeners.delete(k);
    };
    return this.listeners.add(k), k;
  }
  on(g, h) {
    return this.addListener(g, h);
  }
  once(g, h) {
    return this.addListener(g, h, { once: true });
  }
  wait(g) {
    return new Promise((h) => {
      this.once(g, (j) => {
        h(j);
      });
    });
  }
  emit(g, h) {
    this.dispatchEvent(new m(g, h));
  }
  destroy() {
    for (let g of this.listeners)
      g();
    this.listeners.clear();
  }
}

// src/websocket.ts
function createWebsocket(options) {
  if (Object.keys(options.headers || {}).length > 0) {
    console.warn("[@extws/client] Headers are not supported while using WebSocket in browser. They will be ignored.");
  }
  return new WebSocket(options.url);
}

// src/main.ts
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && value.constructor === Object;
}
var BROKEN_STATES = new Set([
  2,
  3
]);

class ExtWSClient extends q {
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
      this.websocket?.send(buildPayload(PayloadType.PING));
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
      } = parsePayload(event.data);
      switch (payload_type) {
        case PayloadType.INIT:
          if (!isPlainObject(data) || typeof data.id !== "string" || typeof data.idle_timeout !== "number") {
            throw new TypeError("Invalid data received.");
          }
          this.websocket_state.socket_id = data.id;
          this.websocket_state.idle_timeout = data.idle_timeout * 1000;
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
    if (this.is_connected) {
      this.websocket?.send(buildPayload(PayloadType.MESSAGE, event_type, data));
    }
  }
}
export {
  ExtWSClient
};
