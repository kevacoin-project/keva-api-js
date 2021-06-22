import exp from 'constants';
import KevaWS from './index';

// TODO: Consider bundling the development server via docker.
// TODO: This would allow easy dev/prod split without deps being present
//const URL = "ws://127.0.0.1:8088";
const URL = 'wss://ec0.kevacoin.org:8443';

test('getKeyValues', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getKeyValues(
    'Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg'
  );
  expect(result.data.length).toBeGreaterThan(10);

  const moreResult = await kevaWS.getKeyValues(
    'Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg',
    result.min_tx_num
  );
  expect(moreResult.data.length).toBeGreaterThan(2);
  kevaWS.close();
});

test('getValue', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();

  // Get the latest value.
  const result = await kevaWS.getValue(
    'Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg',
    'NFTs on Keva!'
  );
  expect(result.value).toBeDefined();
  expect(result.timestamp).toBeDefined();
  expect(result.height).toBeDefined();

  // Get the value and the history.
  const results = await kevaWS.getValue(
    'Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg',
    'NFTs on Keva!',
    true
  );
  expect(results.length).toBeGreaterThan(0);

  kevaWS.close();
});

test('getTransactions', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getTransactions(
    ['b3047635770ef381966bc653e1833ef2c2872a84d758b9590d25e7d2529f4f98'],
    true
  );
  expect(result.length).toBeGreaterThan(0);
  kevaWS.close();
});

test('getMerkle', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getMerkle(
    'e98c0762842edcab97e2e2e8f2844fdc35c8a78d7dc20a519e7fe7292e402683',
    210
  );
  expect(result.block_height).toBe(210);
  expect(result.pos).toBe(1);
  kevaWS.close();
});

test('getAddressHistory', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getAddressHistory(
    'VE6Q8bpn8gRKRoWXFPXMPFZt6juXYyNbe1'
  );
  expect(result.length).toBeGreaterThan(20);
  kevaWS.close();
});

test('getAddressBalance', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getAddressBalance(
    'VE6Q8bpn8gRKRoWXFPXMPFZt6juXYyNbe1'
  );
  expect(result.confirmed).toBeGreaterThan(10000000000);
  kevaWS.close();
});

test('getIdFromPos', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getIdFromPos(210, 1);
  expect(result).toBe(
    'e98c0762842edcab97e2e2e8f2844fdc35c8a78d7dc20a519e7fe7292e402683'
  );
  kevaWS.close();
});

test('getNamespaceHistory', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getNamespaceHistory(
    'Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg'
  );
  expect(result.length).toBeGreaterThan(0);
  kevaWS.close();
});

test('getNamespaceInfo', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getNamespaceInfo(
    'Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg'
  );
  expect(result.shortCode).toBe('32101');
  kevaWS.close();
});

test('getNamespaceIdFromShortCode', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getNamespaceIdFromShortCode('32101');
  expect(result).toBe('Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg');
  kevaWS.close();
});

test('getHashtag', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result = await kevaWS.getHashtag('Kevacoin');
  expect(result.hashtags.length).toBeGreaterThan(10);
  expect(result.min_tx_num).toBeGreaterThan(500000);
  kevaWS.close();
});
