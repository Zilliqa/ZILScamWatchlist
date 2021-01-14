var assert = require('assert');
const { doesNotMatch } = require('assert');
const { Test } = require('mocha');

const ZilTest = require('zilliqa-testing-library').default;
let deployedScamAddress = "";
let deployedManagementAddress = "";
// Save the deployed address here for later use
const scamContract = `scilla_version 0

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
  msg_to_sender = {_tag : "BurnSuccessCallBack"; _recipient : burn_account; _amount : zero; 
                    burner : _sender; burn_account : burn_account; amount : amount};
  msgs = one_msg msg_to_sender;
  send msgs
end

(* @dev:  Moves an amount tokens from _sender to the recipient. Used by token_owner. *)
(* @dev:  Balance of recipient will increase. Balance of _sender will decrease.      *)
(* @param: to:     Address of the recipient whose balance is increased.              *)
(* @param: amount: Amount of tokens to be sent.                                      *)
transition Transfer(from: ByStr20, to: ByStr20, amount: Uint128)
  IsManager _sender;
  AuthorizedMoveIfSufficientBalance from to amount;
  e = {_eventname : "TransferSuccess"; sender : from; recipient : to; amount : amount};
  event e;
  (* Prevent sending to a contract address that does not support transfers of token *)
  msg_to_recipient = {_tag : "RecipientAcceptTransfer"; _recipient : to; _amount : zero; 
                      sender : _sender; recipient : to; amount : amount};
  msgs = one_msg msg_to_recipient;
  send msgs
end`;

const managementContract = `scilla_version 0

(***************************************************)
(*               Associated library                *)
(***************************************************)
import IntUtils
library FungibleToken

let one_msg = 
  fun (msg : Message) => 
  let nil_msg = Nil {Message} in
  Cons {Message} msg nil_msg

(* Error events *)
type Error =
| CodeIsNotManager
| CodeManagerExists
| CodeManagerNotExists


let make_error =
  fun (result : Error) =>
    let result_code = 
      match result with
      | CodeIsNotManager     => Int32 -1
      | CodeManagerExists    => Int32 -2
      | CodeManagerNotExists => Int32 -3
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

contract ScamManagement
(
  contract_owner: ByStr20,
  name : String,
  init_scam_token_address: ByStr20,
  init_manager: ByStr20
)

(* Mutable fields *)

(* List of minters available *)
field managers: Map ByStr20 Unit 
  = let emp_map = Emp ByStr20 Unit in
    let authorize = Unit in
    builtin put emp_map init_manager authorize
    
field scam_token_address: ByStr20 = init_scam_token_address
(**************************************)
(*             Procedures             *)
(**************************************)

procedure ThrowError(err : Error)
  e = make_error err;
  throw e
end

(* @dev:   Checks if address is in manager list                   *)
(* @param: manager: Address of the manager to be checked          *)
(* Returns error event CodeIsNotManager if manager is not in list *)
procedure isManager(address: ByStr20)
  some_manager <- managers[address];
  match some_manager with
  | None =>
    err = CodeIsNotManager;
    ThrowError err   
  | Some Unit => 
  end
end

(***************************************)
(*             Transitions             *)
(***************************************)

(* @dev:   Add approved managers. Only existing managers can add managers. *)
(* @param: manager: Address of the manager to be approved                  *)
(* Returns error event CodeManagerExists if manager already approved       *)
transition addManagers(manager: ByStr20)
  isManager _sender;
  some_manager <- managers[manager];
  match some_manager with
  | Some Unit => 
    err = CodeManagerExists;
    ThrowError err
  | None =>
    authorize = Unit;
    managers[manager] := authorize;
    (* Emit success event *)
    e = {_eventname: "AddManagerSuccess"; manager: manager};
    event e
  end
end

(* @dev:   Remove approved managers. Only existing managers can remove managers. *)
(* @param: manager: Address of the manager to be remove                          *)
(* Returns error event CodeManagerNotExists if manager is already not approved   *)
transition removeManagers(manager: ByStr20)
  isManager _sender;
  some_manager <- managers[manager];
  match some_manager with
  | Some Unit => 
    delete managers[manager];
    (* Emit success event *)
    e = {_eventname: "RemoveManagerSuccess"; manager: manager};
    event e
  | None =>
    err = CodeManagerNotExists;
    ThrowError err
  end
end

(* @dev:   Change scam_token_address field to new_scam_token_address   *)
(* @param: new_scam_token_address: scam token address to be changed to *)
transition ChangeScamTokenAddress(new_scam_token_address: ByStr20)
  isManager _sender;
  scam_token_address := new_scam_token_address;
  e = {_eventname: "ChangedScamTokenAddress"; new_scam_token_address: new_scam_token_address};
  event e  
end

(* @dev:   Call ChangeManager transition from ScamToken contract   *)
(* @param: new_manager: management contract to be changed to       *)
transition callChangeManager(new_manager: ByStr20)
  isManager _sender;
  address <- scam_token_address;
  msg_to_scam_token = {_tag: "ChangeManager"; _recipient: address; _amount: zero; new_manager: new_manager};
  msgs = one_msg msg_to_scam_token;
  send msgs
end

(* @dev:   Call Mint transition from ScamToken contract                       *)
(* @param: recipient: Address of the recipient whose balance is to increase.  *)
(* @param: amount:    Number of tokens to be minted.                          *)
transition callMint(recipient: ByStr20, amount: Uint128)
  isManager _sender;
  address <- scam_token_address;
  msg_to_scam_token = {_tag: "Mint"; _recipient: address; _amount: zero; recipient: recipient; amount: amount};
  msgs = one_msg msg_to_scam_token;
  send msgs
end

(* @dev:   Call Burn transition from ScamToken contract                            *)
(* @param: burn_account: Address of the token_owner whose balance is to decrease.  *)
(* @param: amount:       Number of tokens to be burned.                            *)
transition callBurn(burn_account: ByStr20, amount: Uint128)
  isManager _sender;
  address <- scam_token_address;
  msg_to_scam_token = {_tag : "Burn"; _recipient : address; _amount : zero; 
                    burn_account : burn_account; amount : amount};
  msgs = one_msg msg_to_scam_token;
  send msgs
end

(* @dev:   Call Transfer transition from ScamToken contract             *)
(* @param: to:     Address of the recipient whose balance is increased. *)
(* @param: amount: Amount of tokens to be sent.                         *)
transition callTransfer(from: ByStr20, to: ByStr20, amount: Uint128)
  isManager _sender;
  address <- scam_token_address;
  msg_to_scam_token = {_tag : "Transfer"; _recipient : address; _amount : zero; 
                  from: from; to : to; amount : amount};
  msgs = one_msg msg_to_scam_token;
  send msgs
end`;

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
  }).timeout(10000);

  it('Load contract into Testing Suite and run scilla checker', async function () {
    await Test.loadContract(scamContract); // Contracts[0]
    await Test.loadContract(managementContract);
    assert(Test.contracts.length === 2);
  }).timeout(10000);

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
  }).timeout(10000);

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
  }).timeout(10000);

  //todo
  it('Add manager to manager list', async function () {
    const deployed = Test.deployedContracts[deployedManagementAddress];
    //assert(state.managers.has(Test.accounts[2].address.toLowerCase()));
    const callTx = await deployed.addManagers(Test.accounts[2].address, { manager: Test.accounts[3].address});
    assert(callTx.receipt.success === true);
    
    
    const state2 = await deployed.getState();
    assert(state2.managers[Test.accounts[3].address.toLowerCase()].constructor.toLowerCase() === "unit");
  }).timeout(10000);

  //todo
  it('Remove manager from manager list', async function () {
    const deployed = Test.deployedContracts[deployedManagementAddress];
    //assert(state.managers.has(Test.accounts[2].address.toLowerCase()));
    const callTx = await deployed.removeManagers(Test.accounts[2].address, { manager: Test.accounts[3].address});
    assert(callTx.receipt.success === true);
    const state2 = await deployed.getState();
    console.log(state2.managers[Test.accounts[3].address]);
  }).timeout(10000);



  it('Calls Mint transition in ScamTokenContract', async function () {
    const deployedScam = Test.deployedContracts[deployedScamAddress];
    const deployedManagement = Test.deployedContracts[deployedManagementAddress];
    const callTx = await deployedScam.ChangeManager(Test.accounts[0].address, { new_manager: deployedManagementAddress});
    const callTx2 = await deployedManagement.callMint(Test.accounts[2].address, { recipient: Test.accounts[2].address, amount: "1000" });
    assert(callTx2.receipt.success === true);
    const state = await deployedScam.getState();
    assert(state.balances[Test.accounts[2].address.toLowerCase()]=== "1000");
  }).timeout(10000);

  it('Calls Burn transition in ScamTokenContract', async function () {
    const deployedScam = Test.deployedContracts[deployedScamAddress];
    const deployedManagement = Test.deployedContracts[deployedManagementAddress];
    const callTx2 = await deployedManagement.callBurn(Test.accounts[2].address, { burn_account: Test.accounts[0].address, amount: "1000" });
    assert(callTx2.receipt.success === true);
    const state = await deployedScam.getState();
    assert(state.balances[Test.accounts[0].address.toLowerCase()]=== "9000");
  }).timeout(10000);

it('Calls Transfer transition in ScamTokenContract', async function () {
    const deployedScam = Test.deployedContracts[deployedScamAddress];
    const deployedManagement = Test.deployedContracts[deployedManagementAddress];
    const callTx3 = await deployedManagement.callTransfer(Test.accounts[2].address, { from: Test.accounts[2].address, to: Test.accounts[0].address, amount: "500" });
    console.log(callTx3.receipt);
    assert(callTx3.receipt.success === true);
    const state = await deployedScam.getState();
    assert(state.balances[Test.accounts[0].address.toLowerCase()]=== "9500");
    assert(state.balances[Test.accounts[2].address.toLowerCase()]=== "500");
  }).timeout(10000);

  
});
