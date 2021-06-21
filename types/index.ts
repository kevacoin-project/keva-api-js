import WS from "ws";

export type UnixDate = number;

export namespace Keva {
  // TODO: Make this more complete
  export interface Transaction {
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
  export interface WebSocketEvent<T> extends WebSocket.MessageEvent {
    data: T;
  }

  export interface WebSocket extends WS {
    onmessage: (event: WebSocketEvent<WS.Data>) => void;
  }
}
