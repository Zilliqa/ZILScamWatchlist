var assert = require('assert');
var chai = require('chai'),
    expect = chai.expect;
const { doesNotMatch } = require('assert');
const { Test } = require('mocha');
const fs = require('fs');
const ZilTest = require('zilliqa-testing-library').default;
let deployedScamAddress = "";
let deployedManagementAddress = "";
// Save the deployed address here for later use
const scamContract = fs.readFileSync("scamtoken.scilla").toString();

const managementContract = fs.readFileSync("scammanagement.scilla").toString();

describe('Management', function () {
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
  }).timeout(15000);

  it('Load contract into Testing Suite and run scilla checker', async function () {
    await Test.loadContract(scamContract); // Contracts[0]
    await Test.loadContract(managementContract);
    assert(Test.contracts.length === 2);
  }).timeout(15000);

  it('Deploy ScamToken contract', async function () {
    const preparedScamContract = Test.contracts[0];

    const [tx, deployed] = await preparedScamContract.deploy(
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
    deployedScamAddress = deployed.address;
  }).timeout(15000);

  it('Deploy Management contract', async function () {
    const preparedManagementContract = Test.contracts[1];

    const [tx2, deployed] = await preparedManagementContract.deploy(
      Test.accounts[2].address,
      {
        contract_owner: Test.accounts[2].address,
        name : "Management",
        init_scam_token_address: deployedScamAddress,
        init_manager: Test.accounts[2].address
      }
    );

    assert(tx2.receipt.success === true);

    // Save for later use
    deployedManagementAddress = deployed.address;
  }).timeout(15000);

  //todo
  it('Add manager to manager list', async function () {
    const deployed = Test.deployedContracts[deployedManagementAddress];
    //assert(state.managers.has(Test.accounts[2].address.toLowerCase()));
    const callTx = await deployed.addManagers(Test.accounts[2].address, { manager: Test.accounts[3].address});
    assert(callTx.receipt.success === true);
    const state2 = await deployed.getState();
    assert(state2.managers[Test.accounts[3].address.toLowerCase()].constructor.toLowerCase()==='unit');
    
  }).timeout(15000);

  //todo
  it('Remove manager from manager list', async function () {
    const deployed = Test.deployedContracts[deployedManagementAddress];
    const state = await deployed.getState();
    expect(state.managers).to.have.property(Test.accounts[3].address.toLowerCase());
    const callTx = await deployed.removeManagers(Test.accounts[2].address, { manager: Test.accounts[3].address});
    assert(callTx.receipt.success === true);
    const state2 = await deployed.getState();
    expect(state2.managers).to.not.have.property(Test.accounts[3].address.toLowerCase());
  }).timeout(15000);



  it('Calls Mint transition in ScamTokenContract', async function () {
    const deployedScam = Test.deployedContracts[deployedScamAddress];
    const deployedManagement = Test.deployedContracts[deployedManagementAddress];
    const callTx = await deployedScam.ChangeManager(Test.accounts[0].address, { new_manager: deployedManagementAddress});
    const callTx2 = await deployedManagement.callMint(Test.accounts[2].address, { recipient: Test.accounts[2].address, amount: "1000" });
    assert(callTx2.receipt.success === true);
    const state = await deployedScam.getState();
    assert(state.balances[Test.accounts[2].address.toLowerCase()]=== "1000");
  }).timeout(15000);

  it('Calls Burn transition in ScamTokenContract', async function () {
    const deployedScam = Test.deployedContracts[deployedScamAddress];
    const deployedManagement = Test.deployedContracts[deployedManagementAddress];
    const callTx2 = await deployedManagement.callBurn(Test.accounts[2].address, { burn_account: Test.accounts[0].address, amount: "1000" });
    assert(callTx2.receipt.success === true);
    const state = await deployedScam.getState();
    assert(state.balances[Test.accounts[0].address.toLowerCase()]=== "9000");
  }).timeout(15000);

it('Calls Transfer transition in ScamTokenContract', async function () {
    const deployedScam = Test.deployedContracts[deployedScamAddress];
    const deployedManagement = Test.deployedContracts[deployedManagementAddress];
    const callTx3 = await deployedManagement.callTransfer(Test.accounts[2].address, { from: Test.accounts[2].address, to: Test.accounts[0].address, amount: "500" });
    assert(callTx3.receipt.success === true);
    const state = await deployedScam.getState();
    assert(state.balances[Test.accounts[0].address.toLowerCase()]=== "9500");
    assert(state.balances[Test.accounts[2].address.toLowerCase()]=== "500");
  }).timeout(15000);

  
});
