import {
	test,
	expect,
	describe,
	vi,
} from 'vitest';
import { ExtWSUwsServer } from '@extws/server-uws';
import { ExtWSClient } from './main.js';

const server = new ExtWSUwsServer({
	port: 8000,
});

vi.useFakeTimers({
	shouldAdvanceTime: true,
});

/**
 * Sets a timeout for an async function
 * @param ms - Time in milliseconds
 * @returns -
 */
function asyncTimeout(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

describe('connect', () => {
	test('connection with default options', async () => {
		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
		);
		expect(client.is_connected).toBe(false);

		await client.wait('connect');
		expect(client.is_connected).toBe(true);
	});

	test('manual connection', async () => {
		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				connect: false,
			},
		);

		expect(client.is_connected).toBe(false);

		client.connect();
		await client.wait('connect');

		expect(client.is_connected).toBe(true);
	});
});

describe('reconnect', () => {
	test('auto reconnection', async () => {
		const TIME = 1000;

		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				reconnect: true,
				reconnect_interval: TIME,
			},
		);

		await client.wait('connect');

		// gracefully disconnect client from the server
		server.clients.get(client.id!)!.disconnect();
		await client.wait('disconnect');

		vi.advanceTimersByTime(TIME * 1.1);
		await asyncTimeout(100);
		expect(client.is_connected).toBe(true);
	});

	test('no auto reconnection', async () => {
		const TIME = 1000;

		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				reconnect: false,
				reconnect_interval: TIME,
			},
		);

		await client.wait('connect');

		// gracefully disconnect client from the server
		server.clients.get(client.id!)!.disconnect();
		await client.wait('disconnect');

		vi.advanceTimersByTime(TIME * 1.1);
		await asyncTimeout(100);
		expect(client.is_connected).toBe(false);
	});
});

describe('headers', () => {
	test('custom headers are received by server', async () => {
		const HEADER = 'x-custom-header'; // FIXME: should be `X-Custom-Header` when we support Headers class
		const VALUE = 'test-value';

		const promise = server.wait('connect');

		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				connect: false,
			},
		);

		client.headers[HEADER] = VALUE;
		client.connect();

		const event = await promise;

		expect(
			event.client.headers.get(HEADER),
		).toBe(VALUE);
	});
});

describe('timers', () => {
	test('ping_timeout', async () => {
		const TIME_PING = 5000;

		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				reconnect: false,
				ping_timeout: TIME_PING,
			},
		);

		await client.wait('connect');
		expect(client.is_connected).toBe(true);

		// @ts-expect-error shutting down the client without gracefully closing the connection
		server.clients.get(client.id!)!.uws_client.close();

		vi.advanceTimersByTime(100);
		expect(client.is_connected).toBe(true);

		// idle_timeout
		vi.advanceTimersByTime(60_000);
		// At this step, the client would have sent a PING, and started the `dead` timer for another 1 second.

		// Now rewind for another 1 second (ping_timeout * 1e3)
		vi.advanceTimersByTime(TIME_PING * 1.1);
		expect(client.is_connected).toBe(false);
	});

	test('reconnect_interval', async () => {
		const TIME = 1000;

		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				reconnect: true,
				reconnect_interval: TIME,
			},
		);

		await client.wait('connect');
		expect(client.is_connected).toBe(true);

		// gracefully disconnect client from the server
		server.clients.get(client.id!)!.disconnect();

		await client.wait('disconnect');
		expect(client.is_connected).toBe(false);

		vi.advanceTimersByTime(TIME * 1.1);
		await client.wait('connect');
		expect(client.is_connected).toBe(true);
	});
});
