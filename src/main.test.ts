import {
	test,
	expect,
	describe,
} from 'vitest';
import { ExtWSBunServer } from '@extws/server-bun';
import { ExtWSClient } from './main.js';

const server = new ExtWSBunServer({
	port: 8000,
});

/**
 * Delay execution
 * @param ms - Time in milliseconds
 * @returns -
 */
function delay(ms: number) {
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
		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				reconnect: true,
				reconnect_interval: 100,
			},
		);

		await client.wait('connect');

		client.disconnect();
		await delay(200); // Wait for reconnection

		expect(client.is_connected).toBe(true);
	});

	test('no auto reconnection', async () => {
		const client = new ExtWSClient(
			new URL('ws://localhost:8000/ws'),
			{
				reconnect: false,
				reconnect_interval: 100,
			},
		);

		await client.wait('connect');

		client.disconnect();
		await delay(200);

		expect(client.is_connected).toBe(false);
	});
});

describe('headers', () => {
	test('custom headers are received by server', async () => {
		const HEADER = 'X-Custom-Header';
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
