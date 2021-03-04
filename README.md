# ZILScamWatchlist

ZILScamWatchlist was made to tackle the growing issues of Zilliqa-related scams. There are multiple known Zilliqa scam addresses, scam websites, and telegram users pretending to be Zilliqa admins. 

## ScamManagement
Proxy address used to call transitions in the other contracts.

Calls transitions in ScamToken, ScamURL and ManagerTracking contracts

## ScamToken
All transitions can only be called from ScamManagement

ZRC2 token contract whose transitions can only be used by verified Zilliqa admins from the proxy address (ScamManagement) 

Zilliqa admins will mint these tokens to Zilliqa addresses involved in scams and the owners of the addresses cannot remove them. 

Websites such as ZilPay can now flag these addresses so users will not be able to interact with them. 

## ScamURL
All transitions can only be called from ScamManagement

Tracks URLs and domains involved in scams

Contract where only Zilliqa admins can add or remove urls

## ManagerTracking
All transitions can only be called from ScamManagement

Allows ZIlliqa admins to add or remove verified Zilliqa telegram ids to a mapping. 

Any user can then check whether a telegram user they are interacting with is a verified Zilliqa personnel on https://security.zilliqa.com/



## Test
/test

Test all contracts: npm test

Test each contract: mocha -timeout 100000 "testfilename" 
