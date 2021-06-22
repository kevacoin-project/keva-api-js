### Keva Javascript API

This library provides a set of Javascript API to access Kevacoin ElectrumX through websocket.

### Quick Start

Install the package:

```
npm i --save keva-api-js
```

Example:

```js
import KevaWS from 'keva-api-js';

async getValue() {
    const kevaWS = new KevaWS("wss://ec1.kevacoin.org:8443");
    await kevaWS.connect();

    const result = await kevaWS.getValue(
        'Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg',
        'NFTs on Keva!'
    );

    // More calls ...

    kevaWS.close();
}
```

### Documentation

TBD
