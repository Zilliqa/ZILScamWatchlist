var assert = require('assert');
var chai = require('chai'),
    expect = chai.expect;
const { doesNotMatch } = require('assert');
const { Test } = require('mocha');
const fs = require('fs');
const ZilTest = require('zilliqa-testing-library').default;
let deployedScamTokenAddress = "";
let deployedScamURLAddress = "";
let deployedManagerTrackingAddress = "";
let deployedManagementAddress = "";

// Save the deployed address here for later use
const scamTokenContract = fs.readFileSync("../contracts/scamtoken.scilla").toString();
const scamURLContract = fs.readFileSync("../contracts/scamurl.scilla").toString();
const managerTrackingContract = fs.readFileSync("../contracts/managertracking.scilla").toString();
const managementContract = fs.readFileSync("../contracts/scammanagement.scilla").toString();

describe('Management', function () {
  const Test = new ZilTest();
  let deployedScamToken = "";
  let deployedScamURL = "";
  let deployedManagerTracking = "";
  let deployedManagement = "";
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
    await Test.loadContract(scamTokenContract); // Contracts[0]
    await Test.loadContract(scamURLContract);
    await Test.loadContract(managerTrackingContract);
    await Test.loadContract(managementContract);
    assert(Test.contracts.length === 4);
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
    deployedScamTokenAddress = deployed.address;
    deployedScamToken = Test.deployedContracts[deployedScamTokenAddress];
  });

  it('Deploy ScamURL contract', async function () {
    const preparedContract = Test.contracts[1];

    const [tx, deployed] = await preparedContract.deploy(
      acc0,
      {
        contract_owner: acc0,
        name: "ScamURL",
        init_management_contract: acc0
      }
    );

    assert(tx.receipt.success === true);

    // Save for later use
    deployedScamURLAddress = deployed.address;
    deployedScamURL = Test.deployedContracts[deployedScamURLAddress];

  });

  it('Deploy ManagerTracking contract', async function () {
    const preparedContract = Test.contracts[2];

    const [tx, deployed] = await preparedContract.deploy(
      acc0,
      {
        contract_owner: acc0,
        name: "ManagerTracking",
        init_management_contract: acc0
      }
    );

    assert(tx.receipt.success === true);

    // Save for later use
    deployedManagerTrackingAddress = deployed.address;
    deployedManagerTracking = Test.deployedContracts[deployedManagerTrackingAddress];
    
  });

  it('Deploy Management contract', async function () {
    const preparedManagementContract = Test.contracts[3];

    const [tx2, deployed] = await preparedManagementContract.deploy(
      acc2,
      {
        contract_owner: acc2,
        name : "Management",
        init_scam_token_address: deployedScamTokenAddress,
        init_scam_url_address: deployedScamURLAddress,
        init_manager_tracking_address: deployedManagerTrackingAddress,
        init_manager: acc2
      }
    );

    assert(tx2.receipt.success === true);

    // Save for later use
    deployedManagementAddress = deployed.address;
    deployedManagement = Test.deployedContracts[deployedManagementAddress];
  });

  it('Add manager to manager list', async function () {
    //assert(state.managers.has(Test.accounts[2].address.toLowerCase()));
    const callTx = await deployedManagement.addManagers(acc2, { manager: acc3});
    assert(callTx.receipt.success === true);
    const state2 = await deployedManagement.getState();
    assert(state2.managers[acc3.toLowerCase()].constructor.toLowerCase()==='unit');
    
  });

  it('Remove manager from manager list', async function () {
    const state = await deployedManagement.getState();
    expect(state.managers).to.have.property(acc3.toLowerCase());
    const callTx = await deployedManagement.removeManagers(acc2, { manager: acc3});
    assert(callTx.receipt.success === true);
    const state2 = await deployedManagement.getState();
    expect(state2.managers).to.not.have.property(acc3.toLowerCase());
  });

  it('Non-manager cannot add or remove manager', async function () {
    const callTx = await deployedManagement.addManagers(acc3, { manager: acc3});
    assert(callTx.receipt.success === false);
    const callTx2 = await deployedManagement.removeManagers(acc3, { manager: acc2});
    assert(callTx2.receipt.success === false);
  });

  it('Change management contract for all 3 contracts', async function () {
    const callTx = await deployedScamToken.ChangeManagementContract(acc0, {new_management_contract: deployedManagementAddress});
    const callTx2 = await deployedScamURL.ChangeManagementContract(acc0, {new_management_contract: deployedManagementAddress});
    const callTx3 = await deployedManagerTracking.ChangeManagementContract(acc0, {new_management_contract: deployedManagementAddress});
    const callTx4 = await deployedManagement.CallChangeManagementContract(acc2, {new_management_contract: deployedManagementAddress});
    assert(callTx4.receipt.success === true);
    const state = await deployedScamToken.getState();
    const state2 = await deployedScamURL.getState();
    const state3 = await deployedManagerTracking.getState();
    assert(state.management_contract === deployedManagementAddress.toLowerCase());
    assert(state2.management_contract === deployedManagementAddress.toLowerCase());
    assert(state3.management_contract === deployedManagementAddress.toLowerCase());

  });

  it('Calls Mint transition in ScamTokenContract', async function () {
    const callTx2 = await deployedManagement.callMint(acc2, { recipient: acc2, amount: "1000" });
    assert(callTx2.receipt.success === true);
    const state = await deployedScamToken.getState();
    assert(state.balances[acc2.toLowerCase()]=== "1000");
  });

  it('Calls Burn transition in ScamTokenContract', async function () {
    const callTx = await deployedManagement.callBurn(acc2, { burn_account: acc0, amount: "1000" });
    assert(callTx.receipt.success === true);
    const state = await deployedScamToken.getState();
    assert(state.balances[acc0.toLowerCase()]=== "9000");
  });

  it('Calls Transfer transition in ScamTokenContract', async function () {
    const callTx = await deployedManagement.callTransfer(acc2, { from: acc2, to: acc0, amount: "500" });
    assert(callTx.receipt.success === true);
    const state = await deployedScamToken.getState();
    assert(state.balances[acc0.toLowerCase()]=== "9500");
    assert(state.balances[acc2.toLowerCase()]=== "500");
  });

  it('Calls AddURL transition in ScamURLContract', async function () {
    const callTx2 = await deployedManagement.callAddURL(acc2, { url: "google.com/horses", category: "phishing" });
    assert(callTx2.receipt.success === true);
    const state = await deployedScamURL.getState();
    assert(state.urls["google.com/horses"]=== "phishing");
  });

  it('Calls RemoveURL transition in ScamURLContract', async function () {
    const callTx = await deployedManagement.callRemoveURL(acc2, { url: "google.com/horses" });
    assert(callTx.receipt.success === true);
    const state = await deployedScamURL.getState();
    expect(state.urls).to.not.have.property("google.com/horses");
  });

  it('Calls AddDomain transition in ScamURLContract', async function () {
    const callTx = await deployedManagement.callAddDomain(acc2, { domain: "google.com", category: "phishing" });
    assert(callTx.receipt.success === true);
    const state = await deployedScamURL.getState();
    assert(state.domains["google.com"] === "phishing");
  });

  it('Calls RemoveDomain transition in ScamURLContract', async function () {
    const callTx = await deployedManagement.callRemoveDomain(acc2, { domain: "google.com" });
    assert(callTx.receipt.success === true);
    const state = await deployedScamURL.getState();
    expect(state.domains).to.not.have.property("google.com");
  });

  it('Calls AddAdmin transition in ManagerTrackingContract', async function () {
    const callTx2 = await deployedManagement.callAddAdmin(acc2, { user_id: "Amrit", role: "President" });
    assert(callTx2.receipt.success === true);
    const state = await deployedManagerTracking.getState();
    assert(state.admins["Amrit"] === "President");
  });

  it('Calls RemoveAdmin transition in ManagerTrackingContract', async function () {
    const callTx2 = await deployedManagement.callRemoveAdmin(acc2, { user_id: "Amrit" });
    assert(callTx2.receipt.success === true);
    const state = await deployedManagerTracking.getState();
    expect(state.admins).to.not.have.property("Amrit");
  });

  it('Change contract address for all 3 contracts', async function () {
    const callTx = await deployedManagement.ChangeScamTokenAddress(acc2, {new_scam_token_address: acc3});
    const callTx2 = await deployedManagement.ChangeScamURLAddress(acc2, {new_scam_url_address: acc3});
    const callTx3 = await deployedManagement.ChangeManagerTrackingAddress(acc2, {new_manager_tracking_address: acc3});
    const state = await deployedManagement.getState();
    assert(state.scam_token_address === acc3.toLowerCase());
    assert(state.scam_url_address === acc3.toLowerCase());
    assert(state.manager_tracking_address === acc3.toLowerCase());
  });
});
