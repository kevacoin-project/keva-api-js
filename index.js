const WebSocket = require('isomorphic-ws');
const Buffer = require('buffer').Buffer;
const bitcoin = require('bitcoinjs-lib');
const base58check = require('bs58check')

const KEVA_OP_NAMESPACE = 0xd0;
const KEVA_OP_PUT = 0xd1;
const KEVA_OP_DELETE = 0xd2;

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

  async getKeyValues(namespaceId, txNum=-1) {
    const scriptHash = getNamespaceScriptHash(namespaceId, true);
    const promise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log(data.result);
        const resultList = data.result.keyvalues.map(r => {
          r.key = decodeBase64(r.key);
          r.value = decodeBase64(r.value);
          return r;
        });
        console.log(resultList)
        resolve(resultList);
      };
    });
    try {
      this.ws.send(`{"id": 1, "method": "blockchain.keva.get_keyvalues", "params": ["${scriptHash}", ${txNum}]}`);
    } catch (err) {
      return err;
    }
    return await promise;
  }

}

export default KevaWS;