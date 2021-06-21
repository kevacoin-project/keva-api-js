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
