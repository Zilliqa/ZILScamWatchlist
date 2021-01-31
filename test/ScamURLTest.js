var assert = require('assert');
var chai = require('chai'),
    expect = chai.expect;
const { doesNotMatch } = require('assert');
const { Test } = require('mocha');
const fs = require('fs');
const ZilTest = require('zilliqa-testing-library').default;
let scamURLAddress = "";
// Save the scamURL address here for later use
contract = fs.readFileSync("../contracts/scamurl.scilla").toString();

describe('ScamURL', function () {
  const Test = new ZilTest();
  let scamURL = "";
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

  it('Deploy ScamURL contract', async function () {
    const preparedContract = Test.contracts[0];

    const [tx, deployed] = await preparedContract.deploy(
      acc0,
      {
        init_management_contract: acc0
      }
    );

    assert(tx.receipt.success === true);

    // Save for later use
    scamURLAddress = deployed.address;
    scamURL = Test.deployedContracts[scamURLAddress];
  });

  // test ChangeManager
  it('Management-contract is account[0]', async function () {
    const state = await scamURL.getState();
    assert(state.management_contract === acc0.toLowerCase());
  });

  it('Manager can change management-contract', async function () {
    const callTx = await scamURL.ChangeManagementContract(acc0, { new_management_contract: acc1});
    assert(callTx.receipt.success === true); 
    const state = await scamURL.getState();
    assert(state.management_contract === acc1.toLowerCase());
    const callTx2 = await scamURL.ChangeManagementContract(acc1, { new_management_contract: acc0});
    const state2 = await scamURL.getState();
    assert(state2.management_contract === acc0.toLowerCase());
  });

  it('Non-manager cant change management-contract', async function () {
    const callTx = await scamURL.ChangeManagementContract(acc1, { new_management_contract: acc1});
    assert(callTx.receipt.success === false);
    const state = await scamURL.getState();
    assert(state.management_contract === acc0.toLowerCase());
  });

  //test Mint
  it('Manager can add url', async function () {
    const callTx = await scamURL.AddURL(acc0, { url: "google.com/horses", category: "phishing" });
    assert(callTx.receipt.success === true);
    const state = await scamURL.getState();
    assert(state.urls["google.com/horses"] === 'phishing');

  });

  it('Non-Manager cant add url', async function () {
    const callTx = await scamURL.AddURL(acc1, { url: "google.com/horses", category: "phishing" });
    assert(callTx.receipt.success === false);
    
  });

  it('Manager can remove url', async function () {
    const callTx = await scamURL.AddURL(acc0, { url: "google.com/horses", category: "phishing" });
    const state = await scamURL.getState();
    expect(state.urls).to.have.property("google.com/horses");
    const callTx2 = await scamURL.RemoveURL(acc0, { url: "google.com/horses"});
    assert(callTx2.receipt.success === true);
    const state2 = await scamURL.getState();
    expect(state2.urls).to.not.have.property("google.com/horses");

  });

  it('Non-Manager cant remove url', async function () {
    const callTx = await scamURL.AddURL(acc0, { url: "google.com/horses", category: "phishing" });
    const state = await scamURL.getState();
    expect(state.urls).to.have.property("google.com/horses");
    const callTx2 = await scamURL.RemoveURL(acc1, { url: "google.com/horses"});
    assert(callTx2.receipt.success === false);
    const state2 = await scamURL.getState();
    expect(state2.urls).to.have.property("google.com/horses");
  });

  it('Manager can add domain', async function () {
    const callTx = await scamURL.AddDomain(acc0, { domain: "google.com", category: "phishing" });
    assert(callTx.receipt.success === true);
    const state = await scamURL.getState();
    assert(state.domains["google.com"] === 'phishing');
  });

  it('Non-Manager cant add domain', async function () {
    const callTx = await scamURL.AddDomain(acc1, { domain: "google.com", category: "phishing" });
    assert(callTx.receipt.success === false);
  });

  it('Manager can remove domain', async function () {
    const callTx = await scamURL.AddDomain(acc0, { domain: "google.com", category: "phishing" });
    const state = await scamURL.getState();
    expect(state.domains).to.have.property("google.com");
    const callTx2 = await scamURL.RemoveDomain(acc0, { domain: "google.com"});
    assert(callTx2.receipt.success === true);
    const state2 = await scamURL.getState();
    expect(state2.domains).to.not.have.property("google.com");
  });

  it('Non-Manager cant remove domain', async function () {
    const callTx = await scamURL.AddDomain(acc0, { domain: "google.com", category: "phishing" });
    const state = await scamURL.getState();
    expect(state.domains).to.have.property("google.com");
    const callTx2 = await scamURL.RemoveDomain(acc1, { domain: "google.com"});
    assert(callTx2.receipt.success === false);
    const state2 = await scamURL.getState();
    expect(state2.domains).to.have.property("google.com");  
  });
});
