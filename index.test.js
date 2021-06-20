import KevaWS from "./index";

test('getKeyValues', async () => {
  const kevaWS = new KevaWS("wss://ec0.kevacoin.org:8443");
  await kevaWS.connect();
  const result= await kevaWS.getKeyValues("Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg");
  expect(result.data.length).toBeGreaterThan(10);

  const moreResult= await kevaWS.getKeyValues("Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg", result.min_tx_num);
  expect(moreResult.data.length).toBeGreaterThan(2);
  kevaWS.close();
});
