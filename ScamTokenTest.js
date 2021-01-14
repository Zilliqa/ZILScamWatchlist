var assert = require('assert');
const { doesNotMatch } = require('assert');
const { Test } = require('mocha');

const ZilTest = require('zilliqa-testing-library').default;
let deployedAddress = "";
// Save the deployed address here for later use
const contract = `scilla_version 0

(***************************************************)
(*               Associated library                *)
(***************************************************)
import IntUtils
library FungibleToken

let one_msg = 
  fun (msg : Message) => 
  let nil_msg = Nil {Message} in
  Cons {Message} msg nil_msg

let two_msgs =
fun (msg1 : Message) =>
fun (msg2 : Message) =>
  let msgs_tmp = one_msg msg2 in
  Cons {Message} msg1 msgs_tmp
  
(* Error events *)
type Error =
| CodeIsSender
| CodeInsufficientFunds
| CodeInsufficientAllowance
| CodeIsNotManager

let make_error =
  fun (result : Error) =>
    let result_code = 
      match result with
      | CodeIsSender              => Int32 -1
      | CodeInsufficientFunds     => Int32 -2
      | CodeInsufficientAllowance => Int32 -3
      | CodeIsNotManager          => Int32 -4
      end
    in
    { _exception : "Error"; code : result_code }
  
let zero = Uint128 0

(* Dummy user-defined ADT *)
type Unit =
| Unit

let get_val =
  fun (some_val: Option Uint128) =>
  match some_val with
  | Some val => val
  | None => zero
  end

(***************************************************)
(*             The contract definition             *)
(***************************************************)

contract ScamToken
(
  contract_owner: ByStr20,
  name : String,
  symbol: String,
  decimals: Uint32,
  init_supply : Uint128,
  init_manager: ByStr20
)

(* Mutable fields *)

field total_supply : Uint128 = init_supply

field balances: Map ByStr20 Uint128 
  = let emp_map = Emp ByStr20 Uint128 in
    builtin put emp_map contract_owner init_supply

(*initial address that has access to all transitions*)
field manager: ByStr20 = init_manager

(**************************************)
(*             Procedures             *)
(**************************************)

procedure ThrowError(err : Error)
  e = make_error err;
  throw e
end

(* @dev:   check if transition is called by management contract.  *)
(* @param: send_address: Address that sent transition             *)
procedure IsManager(send_address: ByStr20)
  curr_manager <- manager;
  (*check if sender of transition is the management contract*)
  is_manager = builtin eq send_address curr_manager;
  match is_manager with
  | False =>
    err = CodeIsNotManager;
    ThrowError err
  | True =>
  end
end  

(* @dev:   mint tokens for recipient.                                         *)
(* @param: recipient: Address of the recipient whose balance is to increase.  *)
(* @param: amount:    Number of tokens to be minted.                          *)
procedure AuthorizedMint(recipient: ByStr20, amount: Uint128) 
  some_bal <- balances[recipient];
  bal = get_val some_bal;
  new_balance = builtin add amount bal;
  balances[recipient] := new_balance;
  current_total_supply <- total_supply;
  new_total_supply = builtin add current_total_supply amount;
  total_supply := new_total_supply;
  e = {_eventname: "Minted"; minter: _sender; recipient: recipient; amount: amount};
  event e
end

(* @dev:   Burn existing tokens. If from balance less than amount, error.          *)
(* @param: burn_account: Address of the token_owner whose balance is to decrease.  *)
(* @param: amount:       Number of tokens to be burned.                            *)
procedure AuthorizedBurnIfSufficientBalance(burn_account: ByStr20, amount: Uint128)
  o_get_bal <- balances[burn_account];
  bal = get_val o_get_bal;
  can_burn = uint128_le amount bal;
  match can_burn with
  | True =>
    (* Subtract amount from from *)
    new_balance = builtin sub bal amount;
    balances[burn_account] := new_balance;
    current_total_supply <- total_supply;
    new_total_supply = builtin sub current_total_supply amount;
    total_supply := new_total_supply;
    e = {_eventname: "Burnt"; burner: _sender; burn_account: burn_account; amount: amount};
    event e  
  | False =>
    err = CodeInsufficientFunds;
    ThrowError err
  end
end

(* @dev:   Moves an amount tokens from _sender to the recipient. Used by token_owner.  *)
(* @dev:   Balance of recipient will increase. Balance of _sender will decrease.       *)
(* @dev:   If balances less than amount, error                                         *)
(* @param: to:     Address of the recipient whose balance is increased.                *)
(* @param: amount: Amount of tokens to be sent.                                        *)
procedure AuthorizedMoveIfSufficientBalance(from: ByStr20, to: ByStr20, amount: Uint128)
  o_from_bal <- balances[from];
  bal = get_val o_from_bal;
  can_do = uint128_le amount bal;
  match can_do with
  | True =>
    (* Subtract amount from from and add it to to address *)
    new_from_bal = builtin sub bal amount;
    balances[from] := new_from_bal;
    (* Adds amount to to address *)
    get_to_bal <- balances[to];
    new_to_bal = match get_to_bal with
    | Some bal => builtin add bal amount
    | None => amount
    end;
    balances[to] := new_to_bal
  | False =>
    (* Balance not sufficient *)
    err = CodeInsufficientFunds;
    ThrowError err
  end
end

(***************************************)
(*             Transitions             *)
(***************************************)

(* @dev:   Change management contract. Only managers in management contract can call transitions.  *)
(* @param: new_manager: Address of new management contract.                                        *)
transition ChangeManager(new_manager: ByStr20)
  IsManager _sender;
  manager := new_manager;
  e = {_eventname: "ChangedManager"; new_manager: new_manager};
  event e  
end

(* @dev:   Mint new tokens. Only minter which is ssnlist can mint.            *)
(* @param: recipient: Address of the recipient whose balance is to increase.  *)
(* @param: amount:    Number of tokens to be minted.                          *)
transition Mint(recipient: ByStr20, amount: Uint128)
  IsManager _sender;
  AuthorizedMint recipient amount;
    (* Prevent sending to a contract address that does not support transfers of token *)
  msg_to_recipient = {_tag: "RecipientAcceptMint"; _recipient: recipient; _amount: zero; 
                      minter: _sender; recipient: recipient; amount: amount};
  msgs = one_msg msg_to_recipient;
  send msgs
end

(* @dev:   Burn existing tokens. Only contract_owner can burn.                     *)
(* @param: burn_account: Address of the token_owner whose balance is to decrease.  *)
(* @param: amount:       Number of tokens to be burned.                            *)
transition Burn(burn_account: ByStr20, amount: Uint128)
  IsManager _sender;
  AuthorizedBurnIfSufficientBalance burn_account amount;
  msg_to_sender = {_tag : "BurnSuccessCallBack"; _recipient : _sender; _amount : zero; 
                    burner : _sender; burn_account : burn_account; amount : amount};
  msgs = one_msg msg_to_sender;
  send msgs
end

(* @dev:  Moves an amount tokens from _sender to the recipient. Used by token_owner. *)
(* @dev:  Balance of recipient will increase. Balance of _sender will decrease.      *)
(* @param: to:     Address of the recipient whose balance is increased.              *)
(* @param: amount: Amount of tokens to be sent.                                      *)
transition Transfer(to: ByStr20, amount: Uint128)
  IsManager _sender;
  AuthorizedMoveIfSufficientBalance _sender to amount;
  e = {_eventname : "TransferSuccess"; sender : _sender; recipient : to; amount : amount};
  event e;
  (* Prevent sending to a contract address that does not support transfers of token *)
  msg_to_recipient = {_tag : "RecipientAcceptTransfer"; _recipient : to; _amount : zero; 
                      sender : _sender; recipient : to; amount : amount};
  msg_to_sender = {_tag : "TransferSuccessCallBack"; _recipient : _sender; _amount : zero; 
                  sender : _sender; recipient : to; amount : amount};
  msgs = two_msgs msg_to_recipient msg_to_sender;
  send msgs
end`;
describe('ScamToken', function () {
  /*(beforeEach(async () => {
    const Test = new ZilTest();
}).timeout(10000);
*/
  

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
