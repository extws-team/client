import { PayloadData } from '@extws/server/dev';
import { NeoEventTarget } from 'neoevents';
interface ClientOptions {
    connect: boolean;
    reconnect: boolean;
    reconnect_interval: number;
    ping_timeout: number;
}
export declare class ExtWSClient extends NeoEventTarget {
    private websocket;
    private websocket_state;
    url: URL;
    headers: Record<string, string>;
    private options;
    private timeouts;
    constructor(url: URL, options?: Partial<ClientOptions>);
    get is_connected(): boolean;
    get id(): string | null;
    private createPing;
    private sendPing;
    connect(): void;
    disconnect(): void;
    send(event_type: string, data: PayloadData): void;
}
export {};
