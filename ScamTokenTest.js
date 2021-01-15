var assert = require('assert');
const { doesNotMatch } = require('assert');
const { Test } = require('mocha');
const fs = require('fs');
const ZilTest = require('zilliqa-testing-library').default;
let deployedAddress = "";
// Save the deployed address here for later use
contract = fs.readFileSync("scamtoken.scilla").toString();
describe('ScamToken', function () {
  /*(beforeEach(async () => {
    
}).timeout(10000);
*/
  const Test = new ZilTest();

  it('Generate 4 Zilliqa accounts on network', async function () {
    await Test.generateAccounts(4);

    /* await Test.importAccounts([
        "1129f98cf4fe4c4c694a336f62c6e19d5bbdd5407ccb693c8479b410cc379f72",
        "8463bc5b65eb18955c29beee3caf153d9b1ca71ec5eb278bd0aa32e86dfbe427",
        "9fc50ba5371785cbc5d01ca72b823c080733eb35002b23bb3d2d4a299edf12c0",
        "47877930ebe920d3c5d973073cc3e8ce005926c5c51cf44d1d78c3bc06099c38"
    ]); */

    assert(Test.accounts.length === 4);
  }).timeout(10000);

  it('Load contract into Testing Suite and run scilla checker', async function () {
    await Test.loadContract(contract); // Contracts[0]

    assert(Test.contracts.length === 1);
  }).timeout(10000);

  it('Deploy ScamToken contract', async function () {
    const preparedContract = Test.contracts[0];

    const [tx, deployed] = await preparedContract.deploy(
      Test.accounts[0].address,
      {
        contract_owner: Test.accounts[0].address,
        name: "ScamToken",
        symbol: "SToken",
        decimals: "12",
        init_supply: "10000",
        init_manager: Test.accounts[0].address
      }
    );

    assert(tx.receipt.success === true);

    // Save for later use
    deployedAddress = deployed.address;
  }).timeout(10000);

  // test ChangeManager
  it('Manager is account[0]', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const state = await deployed.getState();

    assert(state.manager === Test.accounts[0].address.toLowerCase());
  }).timeout(10000);

  xit('Manager can change manager', async function () {
    const deployed = Test.deployedContracts[deployedAddress];
    
    const callTx = await deployed.ChangeManager(Test.accounts[0].address, { new_manager: Test.accounts[1].address});
    
    assert(callTx.receipt.success === true);
    
    const state = await deployed.getState();

    assert(state.manager === Test.accounts[1].address.toLowerCase());
  }).timeout(10000);

  it('Non-manager cant change manager', async function () {
    const deployed = Test.deployedContracts[deployedAddress];
    
    const callTx = await deployed.ChangeManager(Test.accounts[1].address, { new_manager: Test.accounts[1].address});
    
    assert(callTx.receipt.success === false);
    
    const state = await deployed.getState();

    assert(state.manager === Test.accounts[0].address.toLowerCase());
  }).timeout(10000);

  //test Mint
  xit('Mint 1000 tokens, total supply should be 11000 after', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const recipient = Test.accounts[1].address;

    const callTx = await deployed.Mint(Test.accounts[0].address, { recipient: recipient, amount: "1000" });

    assert(callTx.receipt.success === true);

    const state = await deployed.getState();

    assert(state.balances[recipient.toLowerCase()] === '1000');
    assert(state.total_supply === '11000');

  }).timeout(10000);

  xit('Mint 1000 tokens twice to same recipient, total supply should be 12000 after', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const recipient = Test.accounts[1].address;

    const callTx = await deployed.Mint(Test.accounts[0].address, { recipient: recipient, amount: "1000" });

    assert(callTx.receipt.success === true);

    const callTx2 = await deployed.Mint(Test.accounts[0].address, { recipient: recipient, amount: "1000" });

    assert(callTx2.receipt.success === true);

    const state = await deployed.getState();

    assert(state.balances[recipient.toLowerCase()] === '2000');
    assert(state.total_supply === '12000');

  }).timeout(10000);

  it('Fail if Mint is called by non-manager', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const callTx = await deployed.call(Test.accounts[1].address, 'Mint', { recipient: Test.accounts[0].address, amount: "1000" });

    assert(callTx.receipt.success === false);
  }).timeout(10000);

  //test Burn
  xit('Burn 1000 tokens, total supply should be 9000 after', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const sender = Test.accounts[0].address;
    const recipient = Test.accounts[0].address;

    const callTx = await deployed.call(sender, 'Burn', { burn_account: recipient, amount: "1000" });

    assert(callTx.receipt.success === true);

    const state = await deployed.getState();

    assert(state.balances[recipient.toLowerCase()] === '9000');
    assert(state.total_supply === '9000');
  }).timeout(10000);

  it('Fail if Burn is called by non-manager', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const sender = Test.accounts[1].address;
    const recipient = Test.accounts[0].address;

    const callTx = await deployed.call(sender, 'Burn', { burn_account: recipient, amount: "1000" });

    assert(callTx.receipt.success === false);
  }).timeout(10000);

  it('Fail if burn tokens from tokenless address', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const sender = Test.accounts[0].address;
    const recipient = Test.accounts[1].address;

    const callTx = await deployed.call(sender, 'Burn', { burn_account: recipient, amount: "1000" });

    assert(callTx.receipt.success === false);
  }).timeout(10000);

  it('Fail if burn tokens from address with less tokens than burn amount', async function () {
    const deployed = Test.deployedContracts[deployedAddress];

    const sender = Test.accounts[0].address;
    const recipient = Test.accounts[0].address;

    const callTx = await deployed.call(sender, 'Burn', { burn_account: recipient, amount: "11000" });

    assert(callTx.receipt.success === false);
  }).timeout(10000);

  //test Transfer
  xit('Transfer 1000 tokens from one account to another', async function() {
    const deployed = Test.deployedContracts[deployedAddress];

    const sender = Test.accounts[0].address;
    const recipient = Test.accounts[1].address;

    const callTx = await deployed.Transfer(sender, { to: recipient, amount: "1000" });

    const state = await deployed.getState();

    // Sender should have 9000
    assert(state.balances[sender.toLowerCase()] === '9000');

    // Recipient should have 1000
    assert(state.balances[recipient.toLowerCase()] === '1000');

  }).timeout(10000);

  it('Fail transfer if sender not manager', async function() {
    const deployed = Test.deployedContracts[deployedAddress];

    const sender = Test.accounts[1].address;
    const recipient = Test.accounts[0].address;

    const callTx = await deployed.Transfer(sender, { to: recipient, amount: "1000" });

    assert(callTx.receipt.success === false);
  }).timeout(10000);

  it('Fail transfer if sender balance lower than amount', async function() {
    const deployed = Test.deployedContracts[deployedAddress];

    const sender = Test.accounts[0].address;
    const recipient = Test.accounts[1].address;

    const callTx = await deployed.Transfer(sender, { to: recipient, amount: "11000" });

    assert(callTx.receipt.success === false);
  }).timeout(10000);
});
