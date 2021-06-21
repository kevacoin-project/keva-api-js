import WebSocket from "ws";

export type UnixDate = number;

// TODO: Make this more complete
export interface KVATransaction {
  tx_hash: string;
  // FIXME: This is probably the wrong type for `n`
  n: string;
  t: UnixDate;
  h: number;
  kv: {
    op: number;
    value: string;
  };
}

// TODO: Find out if Data here is ALWAYS a string
// @ts-ignore
export interface KVAWebSocketEvent<T> extends WebSocket.MessageEvent {
  data: T;
}

export interface KVAWebSocket extends WebSocket {
  onmessage: (event: KVAWebSocketEvent<WebSocket.Data>) => void;
}
