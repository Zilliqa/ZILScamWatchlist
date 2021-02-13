var assert = require('assert');
const { doesNotMatch } = require('assert');
const { Test } = require('mocha');
const fs = require('fs');
const ZilTest = require('zilliqa-testing-library').default;
let scamTokenAddress = "";
// Save the scamToken address here for later use
contract = fs.readFileSync("../contracts/scamtoken.scilla").toString();

describe('ScamToken', function () {
  const Test = new ZilTest();
  let scamToken = "";
  let acc0 = "";
  let acc1 = "";
  let acc2 = "";
  let acc3 = "";
  

  it('Generate 4 Zilliqa accounts on network', async function () {
    await Test.generateAccounts(4);

    /* await Test.importAccounts([
        "1129f98cf4fe4c4c694a336f62c6e19d5bbdd5407ccb693c8479b410cc379f72",
        "8463bc5b65eb18955c29beee3caf153d9b1ca71ec5eb278bd0aa32e86dfbe427",
        "9fc50ba5371785cbc5d01ca72b823c080733eb35002b23bb3d2d4a299edf12c0",
        "47877930ebe920d3c5d973073cc3e8ce005926c5c51cf44d1d78c3bc06099c38"
    ]); */
    acc0 = Test.accounts[0].address;
    acc1 = Test.accounts[1].address;
    acc2 = Test.accounts[2].address;
    acc3 = Test.accounts[3].address;
    assert(Test.accounts.length === 4);
  });

  it('Load contract into Testing Suite and run scilla checker', async function () {
    await Test.loadContract(contract); // Contracts[0]
    assert(Test.contracts.length === 1);
  });

  it('Deploy ScamToken contract', async function () {
    const preparedContract = Test.contracts[0];

    const [tx, deployed] = await preparedContract.deploy(
      acc0,
      {
        contract_owner: acc0,
        name: "ScamToken",
        symbol: "SToken",
        decimals: "12",
        init_supply: "10000",
        init_management_contract: acc0
      }
    );

    assert(tx.receipt.success === true);

    // Save for later use
    scamTokenAddress = deployed.address;
    scamToken = Test.deployedContracts[scamTokenAddress];
  });

  // test ChangeManager
  it('Management-contract is acc0', async function () {
    const state = await scamToken.getState();
    assert(state.management_contract === acc0.toLowerCase());
  });

  it('Manager can change management-contract', async function () {
    const callTx = await scamToken.ChangeManagementContract(acc0, { new_management_contract: acc1}); 
    assert(callTx.receipt.success === true);    
    const state = await scamToken.getState();
    assert(state.management_contract === acc1.toLowerCase());
    const callTx2 = await scamToken.ChangeManagementContract(acc1, { new_management_contract: acc0});
    const state2 = await scamToken.getState();
    assert(state2.management_contract === acc0.toLowerCase());
  });

  it('Non-manager cant change management-contract', async function () {
    const callTx = await scamToken.ChangeManagementContract(acc1, { new_management_contract: acc1});   
    assert(callTx.receipt.success === false);    
    const state = await scamToken.getState();
    assert(state.management_contract === acc0.toLowerCase());
  });

  //test Mint
  it('Mint 1000 tokens, total supply should be 11000 after', async function () {
    const callTx = await scamToken.Mint(acc0, { recipient: acc1, amount: "1000" });
    assert(callTx.receipt.success === true);
    const state = await scamToken.getState();
    assert(state.balances[acc1.toLowerCase()] === '1000');
    assert(state.total_supply === '11000');
  });

  it('Mint 1000 tokens twice to same recipient, total supply should be 13000 after', async function () {
    //acc0: 10000 acc1: 1000
    const callTx = await scamToken.Mint(acc0, { recipient: acc1, amount: "1000" });
    assert(callTx.receipt.success === true);
    const callTx2 = await scamToken.Mint(acc0, { recipient: acc1, amount: "1000" });
    assert(callTx2.receipt.success === true);
    const state = await scamToken.getState();
    assert(state.balances[acc1.toLowerCase()] === '3000');
    // acc1 should have 3000
    assert(state.total_supply === '13000');
  });

  it('Fail if Mint is called by non-management-contract', async function () {
    //acc0: 10000 acc1: 3000
    const callTx = await scamToken.call(acc1, 'Mint', { recipient: acc0, amount: "1000" });
    assert(callTx.receipt.success === false);
  });

  //test Burn
  it('Burn 1000 tokens, total supply should be 12000 after', async function () {
    //acc0: 10000 acc1: 3000
    const callTx = await scamToken.call(acc0, 'Burn', { burn_account: acc0, amount: "1000" });
    assert(callTx.receipt.success === true);
    const state = await scamToken.getState();
    // acc0 should have 9000
    assert(state.balances[acc0.toLowerCase()] === '9000');
    assert(state.total_supply === '12000');
  });

  it('Fail if Burn is called by non-management-contract', async function () {
    //acc0: 9000 acc1: 3000
    const callTx = await scamToken.call(acc1, 'Burn', { burn_account: acc0, amount: "1000" });
    assert(callTx.receipt.success === false);
  });

  it('Fail if burn tokens from tokenless address', async function () {
    //acc0: 9000 acc1: 3000
    const callTx = await scamToken.call(acc0, 'Burn', { burn_account: acc2, amount: "1000" });
    assert(callTx.receipt.success === false);
  });

  it('Fail if burn tokens from address with less tokens than burn amount', async function () {
    //acc0: 9000 acc1: 3000
    const callTx = await scamToken.call(acc0, 'Burn', { burn_account: acc0, amount: "10000" });
    assert(callTx.receipt.success === false);
  });
/*
  //test Transfer
  it('Transfer 1000 tokens from sender to another', async function() {
    //acc0: 9000 acc1: 3000
    const callTx = await scamToken.Transfer(acc0, { to: acc2, amount: "2000", initiator: acc0});
    const state = await scamToken.getState();
    assert(state.balances[acc0.toLowerCase()] === '7000');
    // acc2 should have 1000
    assert(state.balances[acc2.toLowerCase()] === '2000');
  });

  it('Fail transfer if sender not management-contract', async function() {
    //acc0: 7000 acc1: 3000 acc2: 2000
    const callTx = await scamToken.Transfer(acc1, {to: acc0, amount: "1000", initiator: acc1});
    assert(callTx.receipt.success === false);
  });

  it('Fail transfer if sender balance lower than amount', async function() {
    //acc0: 7000 acc1: 3000 acc2: 2000
    const callTx = await scamToken.Transfer(acc0, {to: acc1, amount: "10000", initiator: acc0});
    assert(callTx.receipt.success === false);
  });

  //test TransferFrom
  it('Transfer 1000 tokens from one account to another', async function() {
    //acc0: 7000 acc1: 3000 acc2: 2000
    const callTx = await scamToken.TransferFrom(acc0, { from: acc1, to: acc2, amount: "1000", initiator: acc0});
    const state = await scamToken.getState();
    // acc1 should have 2000
    assert(state.balances[acc1.toLowerCase()] === '2000');
    // acc2 should have 3000
    assert(state.balances[acc2.toLowerCase()] === '3000');
  });

  it('Fail transfer if sender not management-contract', async function() {
    const callTx = await scamToken.TransferFrom(acc1, {from: acc1, to: acc0, amount: "1000", initiator: acc1});
    assert(callTx.receipt.success === false);
  });

  it('Fail transfer if sender balance lower than amount', async function() {
    const callTx = await scamToken.TransferFrom(acc0, {from: acc0, to: acc1, amount: "10000", initiator: acc0});
    assert(callTx.receipt.success === false);
  });*/
});
