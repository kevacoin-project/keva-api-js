import KevaWS from "./index";

test('getKeyValues', async () => {
  const kevaWS = new KevaWS("wss://ec0.kevacoin.org:8443");
  await kevaWS.connect();
  const results = await kevaWS.getKeyValues("Nfw2WYkGoSKve74cCfEum67x8bFgpHygxg");
  kevaWS.close();
  expect(results.length).toBeGreaterThan(10);
});
