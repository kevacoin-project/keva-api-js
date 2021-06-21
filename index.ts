// TODO: Convert all of these to "import .. from" instead of requires
import WebSocket from 'isomorphic-ws';
import { Buffer } from 'buffer';
// This one doesn't play very nicely with default exports. May need "* as bitcoin" if you want the bitcoin.crypto code style
import {
  StackElement,
  script as bscript,
  crypto as bcrypto,
} from 'bitcoinjs-lib';
import base58check from 'bs58check';

const KEVA_OP_NAMESPACE = 0xd0;
const KEVA_OP_PUT = 0xd1;
const KEVA_OP_DELETE = 0xd2;

const _KEVA_NS_BUF = Buffer.from('\x01_KEVA_NS_', 'utf8');

// Custom imports
import type { Keva } from './types';

function decodeBase64(key: string) {
  if (!key) {
    return '';
  }

  const keyBuf = Buffer.from(key, 'base64');
  if (keyBuf[0] < 10) {
    // Special protocol, not a valid utf-8 string.
    return keyBuf;
  }
  return keyBuf.toString('utf-8');
}

function namespaceToHex(nsStr) {
  if (!nsStr) {
    return '';
  }
  return base58check.decode(nsStr);
}

function reverse(src) {
  let buffer = Buffer.alloc(src.length);

  for (let i = 0, j = src.length - 1; i <= j; ++i, --j) {
    buffer[i] = src[j];
    buffer[j] = src[i];
  }

  return buffer;
}

function getNamespaceScriptHash(namespaceId, isBase58 = true) {
  const emptyBuffer = Buffer.alloc(0);
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    // TODO: Find out the proper typing for this
    (isBase58
      ? namespaceToHex(namespaceId)
      : Buffer.from(namespaceId, 'hex')) as StackElement,
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN,
  ]);
  let hash = bcrypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

function getNamespaceKeyScriptHash(namespaceId, key) {
  const nsBuffer = namespaceToHex(namespaceId);
  const keyBuffer = Buffer.from(key, 'utf8');
  const totalBuffer = Buffer.concat([nsBuffer as Uint8Array, keyBuffer]);
  const emptyBuffer = Buffer.alloc(0);
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    totalBuffer,
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN,
  ]);
  let hash = bcrypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

function getRootNamespaceScriptHash(namespaceId) {
  const emptyBuffer = Buffer.alloc(0);
  const nsBuf = namespaceId.startsWith('N')
    ? namespaceToHex(namespaceId)
    : Buffer.from(namespaceId, 'hex');
  const totalBuf = Buffer.concat([nsBuf as Uint8Array, _KEVA_NS_BUF]);
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    totalBuf,
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN,
  ]);
  let hash = bcrypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

class KevaWS {
  private ws: Keva.WebSocket;

  constructor(url: string) {
    // FIXME: Try to find a way to do this without type coercion. It WORKS, but it _shouldn't_ need it
    this.ws = new WebSocket(url) as Keva.WebSocket;
  }

  async connect() {
    const promise = new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject('No websocket');
      }

      // Since we do not use this event, we can mark unknown
      this.ws.onopen = (event: unknown) => {
        resolve();
      };
    });
    await promise;
  }

  close() {
    this.ws && this.ws.close();
  }

  async getMerkle(txId: string, height: number) {
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data.toString());
        resolve(data.result);
      };
    });
    try {
      this.ws.send(
        `{"id": 1, "method": "blockchain.transaction.get_merkle", "params": ["${txId}", ${height}]}`
      );
    } catch (err) {
      return err;
    }

    return await promise;
  }

  async getIdFromPos(height: number, pos: unknown) {
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data.toString());
        resolve(data.result);
      };
    });
    try {
      this.ws.send(
        `{"id": 1, "method": "blockchain.transaction.id_from_pos", "params": ["${height}", ${pos}]}`
      );
    } catch (err) {
      return err;
    }

    return await promise;
  }

  async getNamespaceInfo(namespaceId: string) {
    const history = await this.getNamespaceHistory(namespaceId);
    if (!history || history.length == 0) {
      return {};
    }
    // Get short code of the namespace.
    const merkle = await this.getMerkle(history[0].tx_hash, history[0].h);
    if (!merkle) {
      return {};
    }

    let strHeight = merkle.block_height.toString();
    const prefix = strHeight.length;
    const shortCode = prefix + strHeight + merkle.pos.toString();

    const last = history.length - 1;
    const latest = history[last];
    if (latest.kv.op == KEVA_OP_NAMESPACE) {
      // Original creation.
      return {
        displayName: decodeBase64(latest.kv.key),
        shortCode,
      };
    } else {
      const infoStr = decodeBase64(latest.kv.value);
      const info = JSON.parse(infoStr as string);
      return { ...info, shortCode };
    }
  }

  async getNamespaceIdFromShortCode(shortCode) {
    const prefix = parseInt(shortCode.substring(0, 1));
    const height = shortCode.substring(1, 1 + prefix);
    const pos = shortCode.substring(1 + prefix);
    const tx = await this.getIdFromPos(height, pos);
    const transactions = await this.getTransactions([tx]);
    if (!transactions || transactions.length == 0 || !transactions[0].n) {
      return null;
    }
    return transactions[0].n[0];
  }

  async getNamespaceHistory(namespaceId) {
    const scriptHash = getRootNamespaceScriptHash(namespaceId);
    const promise = new Promise<Array<Keva.Transaction>>((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data.toString());
        if (!data.result || data.result.length == 0) {
          return reject('Namespace not found');
        }
        resolve(data.result);
      };
    });
    try {
      this.ws.send(
        `{"id": 1, "method": "blockchain.scripthash.get_history", "params": ["${scriptHash}"]}`
      );
    } catch (err) {
      return err;
    }
    const nsHistory = await promise;
    const txIds = nsHistory.map((t) => t.tx_hash);
    const transactions = await this.getTransactions(txIds);
    return transactions.map((t, i) => {
      t.tx_hash = txIds[i];
      return t;
    });
  }

  async getKeyValues(namespaceId, txNum = -1) {
    const scriptHash = getNamespaceScriptHash(namespaceId, true);
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data.toString());
        const resultList = data.result.keyvalues.map((r) => {
          r.key = decodeBase64(r.key);
          r.value = decodeBase64(r.value);
          return r;
        });
        const min_tx_num = data.result.min_tx_num;
        const result = {
          data: resultList,
          min_tx_num,
        };
        resolve(result);
      };
    });
    try {
      this.ws.send(
        `{"id": 1, "method": "blockchain.keva.get_keyvalues", "params": ["${scriptHash}", ${txNum}]}`
      );
    } catch (err) {
      return err;
    }
    return await promise;
  }

  async getTransactions(
    txIds: Array<string>,
    namespaceInfo = true
  ): Promise<Array<Keva.Transaction>> {
    const promise = new Promise<Array<Keva.Transaction>>((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data.toString());
        resolve(data.result);
      };
    });
    try {
      this.ws.send(
        `{"id": 1, "method": "blockchain.keva.get_transactions_info", "params": [${JSON.stringify(
          txIds
        )}, ${namespaceInfo}]}`
      );
    } catch (err) {
      return err;
    }
    return await promise;
  }

  async getValue(namespaceId: string, key: string, history = false) {
    const scriptHash = getNamespaceKeyScriptHash(namespaceId, key);
    const promise = new Promise<Array<Keva.Transaction>>((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data.toString());
        resolve(data.result);
      };
    });
    try {
      this.ws.send(
        `{"id": 1, "method": "blockchain.scripthash.get_history", "params": ["${scriptHash}"]}`
      );
    } catch (err) {
      return err;
    }
    const txIdResults = await promise;
    const txIds = txIdResults.map((t) => t.tx_hash);
    const results = await this.getTransactions(txIds);
    if (history) {
      return results.map((r) => {
        return {
          value: decodeBase64(r.kv.value),
          timestamp: r.t,
          height: r.h,
        };
      });
    } else {
      // The last one is the latest one.
      const index = results.length - 1;
      if (index < 0) {
        return {};
      }
      const result = results[index];
      if (result.kv.op == KEVA_OP_DELETE || result.kv.op == KEVA_OP_NAMESPACE) {
        // Value deleted or no value (namespace registation).
        return;
      }
      return {
        value: decodeBase64(result.kv.value),
        timestamp: result.t,
        height: result.h,
      };
    }
  }
}

export default KevaWS;
