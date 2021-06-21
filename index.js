const WebSocket = require('isomorphic-ws');
const Buffer = require('buffer').Buffer;
const bitcoin = require('bitcoinjs-lib');
const base58check = require('bs58check')

const KEVA_OP_NAMESPACE = 0xd0;
const KEVA_OP_PUT = 0xd1;
const KEVA_OP_DELETE = 0xd2;

const _KEVA_NS_BUF = Buffer.from('\x01_KEVA_NS_', 'utf8');

function decodeBase64(key) {
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
    return "";
  }
  return base58check.decode(nsStr);
}

function reverse(src) {
  let buffer = Buffer.alloc(src.length)

  for (let i = 0, j = src.length - 1; i <= j; ++i, --j) {
    buffer[i] = src[j]
    buffer[j] = src[i]
  }

  return buffer
}

function getNamespaceScriptHash(namespaceId, isBase58 = true) {
  const emptyBuffer = Buffer.alloc(0);
  let bscript = bitcoin.script;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    isBase58 ? namespaceToHex(namespaceId) : Buffer.from(namespaceId, "hex"),
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN]);
  let hash = bitcoin.crypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

function getNamespaceKeyScriptHash(namespaceId, key) {
  const nsBuffer = namespaceToHex(namespaceId);
  const keyBuffer = Buffer.from(key, 'utf8');
  const totalBuffer = Buffer.concat([nsBuffer, keyBuffer]);
  const emptyBuffer = Buffer.alloc(0);
  let bscript = bitcoin.script;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    totalBuffer,
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN]);
  let hash = bitcoin.crypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}

function getRootNamespaceScriptHash(namespaceId) {
  const emptyBuffer = Buffer.alloc(0);
  const nsBuf = namespaceId.startsWith('N') ? namespaceToHex(namespaceId) : Buffer.from(namespaceId, "hex");
  const totalBuf = Buffer.concat([nsBuf, _KEVA_NS_BUF]);
  let bscript = bitcoin.script;
  let nsScript = bscript.compile([
    KEVA_OP_PUT,
    totalBuf,
    emptyBuffer,
    bscript.OPS.OP_2DROP,
    bscript.OPS.OP_DROP,
    bscript.OPS.OP_RETURN]);
  let hash = bitcoin.crypto.sha256(nsScript);
  let reversedHash = Buffer.from(reverse(hash));
  return reversedHash.toString('hex');
}


class KevaWS {

  constructor(url) {
    this.ws = new WebSocket(url);
  }

  async connect() {
    const promise = new Promise((resolve, reject) => {
      if (!this.ws) {
        reject("No websocket");
      }
      this.ws.onopen = (event) => {
        resolve();
      };
    });
    await promise;
  }

  close() {
    this.ws && this.ws.close();
  }

  async getMerkle(txId, height) {
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        resolve(data.result);
      };
    });
    try {
      this.ws.send(`{"id": 1, "method": "blockchain.transaction.get_merkle", "params": ["${txId}", ${height}]}`);
    } catch (err) {
      return err;
    }

    return await promise;
  }

  async getIdFromPos(height, pos) {
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        resolve(data.result);
      };
    });
    try {
      this.ws.send(`{"id": 1, "method": "blockchain.transaction.id_from_pos", "params": ["${height}", ${pos}]}`);
    } catch (err) {
      return err;
    }

    return await promise;
  }

  async getNamespaceInfo(namespaceId) {
    const history = await this.getNamespaceHistory(namespaceId);
    if (!history || history.length == 0) {
      return {}
    }
    // Get short code of the namespace.
    const merkle = await this.getMerkle(history[0].tx_hash, history[0].h);
    if (!merkle) {
      return {}
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
      }
    } else {
      const infoStr = decodeBase64(latest.kv.value);
      const info = JSON.parse(infoStr);
      return {...info, shortCode}
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
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!data.result || data.result.length == 0) {
          return reject("Namespace not found");
        }
        resolve(data.result);
      };
    });
    try {
      this.ws.send(`{"id": 1, "method": "blockchain.scripthash.get_history", "params": ["${scriptHash}"]}`);
    } catch (err) {
      return err;
    }
    const nsHistory =  await promise;
    const txIds = nsHistory.map(t => t.tx_hash);
    const transactions = await this.getTransactions(txIds);
    return transactions.map((t, i) => {
      t.tx_hash = txIds[i];
      return t;
    })
  }

  async getKeyValues(namespaceId, txNum=-1) {
    const scriptHash = getNamespaceScriptHash(namespaceId, true);
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        const resultList = data.result.keyvalues.map(r => {
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
      this.ws.send(`{"id": 1, "method": "blockchain.keva.get_keyvalues", "params": ["${scriptHash}", ${txNum}]}`);
    } catch (err) {
      return err;
    }
    return await promise;
  }

  async getTransactions(txIds, namespaceInfo = true) {
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        resolve(data.result);
      };
    });
    try {
      this.ws.send(`{"id": 1, "method": "blockchain.keva.get_transactions_info", "params": [${JSON.stringify(txIds)}, ${namespaceInfo}]}`);
    } catch (err) {
      return err;
    }
    return await promise;
  }

  async getValue(namespaceId, key, history = false) {
    const scriptHash = getNamespaceKeyScriptHash(namespaceId, key);
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        resolve(data.result);
      };
    });
    try {
      this.ws.send(`{"id": 1, "method": "blockchain.scripthash.get_history", "params": ["${scriptHash}"]}`);
    } catch (err) {
      return err;
    }
    const txIdResults = await promise;
    const txIds = txIdResults.map(t => t.tx_hash);
    const results = await this.getTransactions(txIds);
    if (history) {
      return results.map(r => {
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
