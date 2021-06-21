import WS from 'ws';

export type UnixDate = number;

export namespace Keva {
  // TODO: Make this more complete
  export interface Transaction {
    tx_hash: string;
    n: [string, number];
    t: UnixDate;
    h: number;
    kv: {
      op: number;
      value: string;
    };
  }

  // TODO: Find out if Data here is ALWAYS a string
  // @ts-ignore
  export interface WebSocketEvent<T> extends WS.MessageEvent {
    data: T;
  }

  export interface WebSocket extends WS {
    onmessage: (event: WebSocketEvent<WS.Data>) => void;
  }
}
