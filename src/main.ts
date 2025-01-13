import {
	buildPayload,
	parsePayload,
	PayloadData,
	PayloadType,
} from '@extws/server/dev';
import { NeoEventTarget } from 'neoevents';
import {
	createWebsocket,
	type LocalWebSocketType,
} from './websocket.js';

const BROKEN_STATES = new Set<number>([
	2, // CLOSING
	3, // CLOSED
]);

interface ClientOptions {
	connect: boolean;
	reconnect: boolean;
	reconnect_interval: number;
	ping_timeout: number;
}

interface WebsocketState {
	socket_id: string | null;
	idle_timeout: number;
	ts_last_message: number;
}

interface ExtWSClientTimeouts {
	ping?: ReturnType<typeof setTimeout>;
	dead?: ReturnType<typeof setTimeout>;
	reconnect?: ReturnType<typeof setTimeout>;
}

/**
 * I
 * @param value - The value to check
 * @returns -Whether the value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object'
		&& value !== null
		&& !Array.isArray(value)
		&& value.constructor === Object;
}

export class ExtWSClient extends NeoEventTarget {
	private websocket: LocalWebSocketType | null = null;
	private websocket_state: WebsocketState | null = null;
	url: URL;
	headers: Record<string, string> = {};
	private options: ClientOptions = {
		connect: true,
		reconnect: true,
		reconnect_interval: 2000,
		ping_timeout: 5000,
	};
	private timeouts: ExtWSClientTimeouts = {};

	constructor(
		url: URL,
		options?: Partial<ClientOptions>,
	) {
		super();

		this.url = url;
		if (options) {
			this.options = {
				...this.options,
				...options,
			};
		}

		if (this.options.connect === true) {
			setTimeout(
				() => this.connect(),
			);
		}

		this.on(
			'disconnect',
			() => {
				this.websocket = null;
				this.websocket_state = null;

				if (this.options.reconnect === true) {
					clearTimeout(this.timeouts.reconnect);

					this.timeouts.reconnect = setTimeout(
						() => this.connect(),
						this.options.reconnect_interval,
					);
				}
			},
		);
	}

	// getOption<K extends keyof ClientOptions>(key: K): ClientOptions[K] {
	// 	return this.options[key] ?? OPTIONS_DEFAULT[key];
	// }

	get is_connected(): boolean {
		return this.websocket !== null
			&& BROKEN_STATES.has(this.websocket.readyState) !== true
			&& typeof this.id === 'string'
			&& Date.now() - this.websocket_state!.ts_last_message < this.websocket_state!.idle_timeout;
	}

	get id() {
		return this.websocket_state?.socket_id ?? null;
	}

	private createPing() {
		clearTimeout(this.timeouts.ping);

		if (this.websocket) {
			this.timeouts.ping = setTimeout(
				() => this.sendPing(),
				this.websocket_state!.idle_timeout - this.options.ping_timeout,
			);
		}
	}

	private sendPing() {
		clearTimeout(this.timeouts.dead);

		if (this.is_connected) {
			this.websocket?.send(
				buildPayload(
					PayloadType.PING,
				),
			);

			this.timeouts.dead = setTimeout(
				() => this.disconnect(),
				this.options.ping_timeout * 1e3,
			);
		}
	}

	connect() {
		if (this.is_connected) {
			return;
		}

		if (this.websocket) {
			this.websocket.close();
		}

		this.emit('beforeconnect');

		const ws = createWebsocket({
			url: this.url,
			headers: this.headers,
		});

		this.websocket = ws;
		this.websocket_state = {
			socket_id: null,
			idle_timeout: 60_000,
			ts_last_message: 0,
		};

		ws.addEventListener(
			'error',
			(error) => {
				// eslint-disable-next-line no-console
				console.error(error);
			},
		);

		ws.addEventListener(
			'open',
			() => {
				if (ws === this.websocket) {
					this.websocket_state!.ts_last_message = Date.now();
					this.createPing();
				}
			},
		);

		ws.addEventListener(
			'message',
			(event) => {
				if (ws !== this.websocket) {
					return;
				}

				clearTimeout(this.timeouts.dead);
				this.createPing();

				this.websocket_state!.ts_last_message = Date.now();

				const {
					payload_type,
					data,
					event_type,
				} = parsePayload(event.data);
				// console.log(payload_type, data, event_type);

				switch (payload_type) {
					case PayloadType.INIT:
						if (
							!isPlainObject(data)
							|| typeof data.id !== 'string'
							|| typeof data.idle_timeout !== 'number'
						) {
							throw new TypeError('Invalid data received.');
						}

						this.websocket_state!.socket_id = data.id;
						this.websocket_state!.idle_timeout = data.idle_timeout * 1000;

						this.emit('connect');

						break;

					case PayloadType.PING:
						ws.send(
							buildPayload(PayloadType.PONG),
						);
						break;

					case PayloadType.MESSAGE:
						this.emit(
							event_type ?? 'message',
							data,
						);
						break;
					// no default
				}
			},
		);

		ws.addEventListener(
			'close',
			() => {
				if (ws === this.websocket) {
					this.websocket_state!.ts_last_message = 0;
					this.emit('disconnect');
				}
			},
		);
	}

	disconnect() {
		clearTimeout(this.timeouts.reconnect);

		this.websocket?.close();
	}

	send(event_type: string, data: PayloadData) {
		if (this.is_connected) {
			this.websocket?.send(
				buildPayload(
					PayloadType.MESSAGE,
					event_type,
					data,
				),
			);
		}
	}
}
