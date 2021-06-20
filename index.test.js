import KevaWS from "./index";

//const URL = "wss://ec0.kevacoin.org:8443";
const URL = "ws://127.0.0.1:8088";

test('getKeyValues', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result= await kevaWS.getKeyValues("Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg");
  expect(result.data.length).toBeGreaterThan(10);

  const moreResult= await kevaWS.getKeyValues("Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg", result.min_tx_num);
  expect(moreResult.data.length).toBeGreaterThan(2);
  kevaWS.close();
});

test('getValue', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();

  // Get the latest value.
  const result = await kevaWS.getValue("Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg", "NFTs on Keva!");
  expect(result.value).toBeDefined();
  expect(result.timestamp).toBeDefined();
  expect(result.height).toBeDefined();

  // Get the value and the history.
  const results = await kevaWS.getValue("Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg", "NFTs on Keva!", true);
  expect(results.length).toBeGreaterThan(0);

  kevaWS.close();
});


test('getTransactions', async () => {
  const kevaWS = new KevaWS(URL);
  await kevaWS.connect();
  const result= await kevaWS.getTransactions(["b3047635770ef381966bc653e1833ef2c2872a84d758b9590d25e7d2529f4f98"], true);
  expect(result.length).toBeGreaterThan(0);
  kevaWS.close();
});
