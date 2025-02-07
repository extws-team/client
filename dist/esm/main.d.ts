import { PayloadData } from '@extws/server/dev';
import { NeoEvent, NeoEventTarget } from 'neoevents';
interface ClientOptions {
    connect: boolean;
    reconnect: boolean;
    reconnect_interval: number;
    ping_timeout: number;
}
type EventMap = {
    beforeconnect: NeoEvent<undefined>;
    connect: NeoEvent<undefined>;
    disconnect: NeoEvent<undefined>;
    [key: string]: NeoEvent;
};
export declare class ExtWSClient extends NeoEventTarget<EventMap> {
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
    send(event_type?: string, data?: PayloadData): void;
}
export {};
