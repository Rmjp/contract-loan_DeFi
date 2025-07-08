# Loan VC

# Setup

All code use node.js.

### Install node package

```bash
npm install
```

## Contract

On `contract` directory.

Base on Amoy chain.

Run on:

- Hardhat Local Node with fork from Amoy
- Amoy
    
    ### For Local Node
    
    ```bash
    npx hardhat node
    ```
    

### Deploy contract

For Local network use `--network local`

**LoanMarketModule**: Market Loan, Lender and Borrower matching. Setting `verifierAddress`  to real Universal Verifier (IDEN3).

```bash
npx hardhat ignition deploy ignition/modules/LoanMarketModule.ts --parameters '{ProxyModule:{"verifierAddress":"0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c"}}' --network amoy
```

**VaultManagerModule**: ERC-4926 implement for Vault

```bash
npx hardhat ignition deploy ignition/modules/VaultManagerModule.ts --network amoy
```

**TestToken** (Optional): ERC-20 Token

```bash
npx hardhat ignition deploy ignition/modules/TestToken.ts --network amoy
```

### Verify (Optional)

```bash
npx hardhat verify --network amoy <contract address>
```

## Wallet

On `wallet` directory.

### Run

```bash
npm run start -- -p 3000
```

## Web

On `web` directory.

### Run

```bash
npm run dev -p 3001
```

### Config

At `web/src/config/contract.ts` 

Constant value to config.

```bash
// URL for wallet configure domain and port
export const WALLET_URL = "http://localhost:3000/index.html#/auth?type=base64&payload=";

// List of Token that will show on list (erc-20)
export const TOKEN_ADDRESS_LIST = [
  { name: 'Test', address: "0x17E6459067dDbB870F8D4E961454eC39C695d35C" }
  ]

// Address of the LoanMarket contract (update with your deployment)
export const CONTRACT_ADDRESS = "0x23771bca866D315A81c97F990fC5eE4533d6b4D0";
// Address of the VaultManager contract (update with your deployment)
export const VAULT_MANAGER_ADDRESS = "0x3DBa092C401E1AA6CD5DB40BCbd52121F3F31de5";
// Address of the UniversalVerifier contract (update with your deployment)
export const VERIFIER_ADDRESS = "0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c";
```

# Wallet

## Issue VC

for test: [https://issuer-demo.privado.id/](https://issuer-demo.privado.id/)

create Schema: [Privado ID Schema Explorer & Builder](https://tools.privado.id/builder)

## Wallet receives VC

1. authentication 

issuer request authentication 

```json
{
    "id": "b54f976d-0f26-4000-84db-ef6672ed6159",
    "typ": "application/iden3comm-plain-json",
    "body": {
        "scope": [],
        "reason": "authentication",
        "callbackUrl": "https://issuer-node-core-api-demo.privado.id/v2/identities/did:iden3:polygon:amoy:xG3SpbMvA3uUnGYDn1WydkpfKq3Kjtv2pWNAwj8k5/credentials/links/callback?linkID=c9b78504-4165-48cb-a4ea-295fcd8b7a27"
    },
    "from": "did:iden3:polygon:amoy:xG3SpbMvA3uUnGYDn1WydkpfKq3Kjtv2pWNAwj8k5",
    "thid": "b54f976d-0f26-4000-84db-ef6672ed6159",
    "type": "https://iden3-communication.io/authorization/1.0/request"
}
```

wallet response as Issuer format (JWZ for privado)

```json
eyJhbGciOiJncm90aDE2IiwiY2lyY3VpdElkIjoiYXV0aFYyIiwiY3JpdCI6WyJjaXJjdWl0SWQiXSwidHlwIjoiYXBwbGljYXRpb24vaWRlbjMtemtwLWpzb24ifQ.eyJpZCI6IjQxODdmYWI5LTMzNjctNDMzZS1iOTdkLTNhYTM0ZmM5OTk3YiIsInR5cCI6ImFwcGxpY2F0aW9uL2lkZW4zLXprcC1qc29uIiwidHlwZSI6Imh0dHBzOi8vaWRlbjMtY29tbXVuaWNhdGlvbi5pby9hdXRob3JpemF0aW9uLzEuMC9yZXNwb25zZSIsInRoaWQiOiJiNTRmOTc2ZC0wZjI2LTQwMDAtODRkYi1lZjY2NzJlZDYxNTkiLCJib2R5Ijp7InNjb3BlIjpbXX0sImZyb20iOiJkaWQ6aWRlbjM6cG9seWdvbjphbW95OnhCWm10MUQzYWVZb2t5UDVEeHdwWW5TdWZjcFBTSHlaUHN6Rm05WFNpIiwidG8iOiJkaWQ6aWRlbjM6cG9seWdvbjphbW95OnhHM1NwYk12QTN1VW5HWURuMVd5ZGtwZktxM0tqdHYycFdOQXdqOGs1In0.eyJwcm9vZiI6eyJwaV9hIjpbIjIxMTcwMTY0MDk1ODg4NjExNTk5MDAzODY3MDAzMTg3NjkyMzc3NzM3NjUxNTAzODEwODM0NjM5MTE3OTg5MzM3NjIxMjU2NDY4MDMxIiwiMzIxNDExNjA1MDQ2MjMyMjM0NTUzMjA4NTM2MTU1MDczOTcyODI1NDI4NTA0MzAxMzc0MTM4Mjg0NjE4NzQzNzE0NjU4NTI4MDUzOSIsIjEiXSwicGlfYiI6W1siMTg3OTI4NjU2MDQ5NjI0MDY3ODM5MjE3MzQ1NTgzODE5NTAzNjAxNTU2OTEyMzc4ODQ1MjE4NzM2NTE3ODkxODMwMjcwMjA5MzYzNDkiLCIxMTE5NDE0MDQ0NzE5MzM2NjYxMzA2ODAyNTA1Nzg1ODMyMTE5MTgxMjYzMTEwNTA0OTY4NzEwNTkwNDc2ODMwOTgxMjU5MzQ1MDg5NyJdLFsiNjMzNjY4NjAxMjQ4NDMzMTkzNTI3MTYzOTk0MDUzMzY5NjQ4ODM1NTYyMTg4NjQ0MDc1ODA4NzE4OTMzOTYzOTY1Nzg1MTA0OTMzNCIsIjE2Mjk2MjYxMTA1ODg5NjkxNTQ3NzI0MTM2MDY1MzkzNjU5ODI3MjA5MTY1NDkwODY3MDk0MTU5MjYxNDAwMzczNTkyODU4NzIyMTExIl0sWyIxIiwiMCJdXSwicGlfYyI6WyI2NTQ1MDUwMjc5NzEzNzM5MTc3MDUzMzU0MjUyMjY1NDU4NjUxMTg3ODE5MjE5NDMyNjc3Njc3OTQxNDY4ODk3NTI0NTE1NzQyNzQ4IiwiMzgxMDk5NjM5MzQ2NTg4ODYxMTc1ODU2MzU0NTkwNDY0NTc4MzIxMzQ2ODYwMDQ5MzYxODcxNjM4MTgxNTgzOTc3OTQ2Mjg0NTIwIiwiMSJdLCJwcm90b2NvbCI6Imdyb3RoMTYiLCJjdXJ2ZSI6ImJuMTI4In0sInB1Yl9zaWduYWxzIjpbIjIxMDIzMDE1MzY5NTcyNzQ5NDc2ODkwNjA4NDMzMzMxNjc4Mzk0MDU3ODg3MzY2MTEzNjE2NDYxMDY5NjQzNTQ3Njk1OTc3MjE3IiwiMTkzMTkwNDE5NDA1MDExNDc2NzYzODc0MTM4MzQ3ODEyMDgwNTgzMTEwNzQ1MTkyNjA1OTk0MzU1NjM5MTcwMDYxMzkyMzAzNTc5NzciLCI1NjA0NjM2NjA0MzQxNjE2MTczODUxMzAxMzM0NTUzMjgzMTYzNjM4MTQ4MzMwNDE4MTM5NDE5OTA2NDc4ODg3ODQyMTc3MzgxODM2Il19
```

1. receive claim

issuer send offer

```json
{
    "id": "90f60f01-963d-41fa-a9ce-7de0ce84057a",
    "typ": "application/iden3comm-plain-json",
    "type": "https://iden3-communication.io/credentials/1.0/offer",
    "thid": "90f60f01-963d-41fa-a9ce-7de0ce84057a",
    "body": {
        "url": "https://issuer-node-core-api-demo.privado.id/v2/agent",
        "credentials": [
            {
                "id": "ccd39a28-415b-11f0-acd0-0a58a9feac02",
                "description": "POAP01"
            }
        ]
    },
    "from": "did:iden3:polygon:amoy:xG3SpbMvA3uUnGYDn1WydkpfKq3Kjtv2pWNAwj8k5",
    "to": "did:iden3:polygon:amoy:xBZmt1D3aeYokyP5DxwpYnSufcpPSHyZPszFm9XSi"
}
```

wallet response as Issuer format (JWZ for privado)

```json
eyJhbGciOiJncm90aDE2IiwiY2lyY3VpdElkIjoiYXV0aFYyIiwiY3JpdCI6WyJjaXJjdWl0SWQiXSwidHlwIjoiYXBwbGljYXRpb24vaWRlbjMtemtwLWpzb24ifQ.eyJpZCI6IjVhZTE5NDNjLWY4ZTEtNGVmNy04ZDkwLThiM2Q0MmNhMzhjYSIsInR5cCI6ImFwcGxpY2F0aW9uL2lkZW4zLXprcC1qc29uIiwidHlwZSI6Imh0dHBzOi8vaWRlbjMtY29tbXVuaWNhdGlvbi5pby9jcmVkZW50aWFscy8xLjAvZmV0Y2gtcmVxdWVzdCIsInRoaWQiOiI5MGY2MGYwMS05NjNkLTQxZmEtYTljZS03ZGUwY2U4NDA1N2EiLCJib2R5Ijp7ImlkIjoiY2NkMzlhMjgtNDE1Yi0xMWYwLWFjZDAtMGE1OGE5ZmVhYzAyIn0sImZyb20iOiJkaWQ6aWRlbjM6cG9seWdvbjphbW95OnhCWm10MUQzYWVZb2t5UDVEeHdwWW5TdWZjcFBTSHlaUHN6Rm05WFNpIiwidG8iOiJkaWQ6aWRlbjM6cG9seWdvbjphbW95OnhHM1NwYk12QTN1VW5HWURuMVd5ZGtwZktxM0tqdHYycFdOQXdqOGs1In0.eyJwcm9vZiI6eyJwaV9hIjpbIjUzMDc1NzQ0MTAxNTEwNjU0MzQ3NDgwMTc5NDgyODgxNzg0Nzk0ODk0MDUzMjYzOTExMjY1NDI1NzAzMTk3NzI5ODgxMDgwMjEzOTgiLCIyMTgzMzEzMjgwNDEzODA1NDM2MDY0MDMxNjI4NDIxMzg4Mzg4MDk0NTM1MDAzMTcxNzM5ODc5Mzc4NjQ4NjU0ODk4MTk1Mjk5MDQ2MyIsIjEiXSwicGlfYiI6W1siMTY1NDAzOTY4NTEzNzc4ODgzNzI3NjgwNDMxNjU1Nzg1MzM2MDMwMzA5MjEzODAzNTMzNzMyNjI0MzQ5NTg2MTcyODAyMjY5NzMwNzkiLCIyMzM3NTI3MDYxNDU0MzE0NDQ5NDE5NzgzNzkzMjg2NDQyNTQzMDQ5ODU3NDE3NTAzMDM0MjMyMjc1NzE5MzA0MjIxNTE1ODcwMjQ3Il0sWyI3ODQ5Mjc3MDM5ODQ3NDIyNTcwNjQ5MTY3NDc0NTI3OTE1OTIzNzY5NDUwMjk3NTQ2MjQ5MTA1NTQ4NjI2NzIyMzY1ODg0NzQ3NTI5IiwiODg3NjY5NjU4OTY4NDg3Njc1ODk1MjI2OTIxMzE3NDQ0NjI5OTMyNDIwODMwNDQyMzg3NzY4Mjg3OTM0NTMzNTU5Nzc4NDcyNTE1Il0sWyIxIiwiMCJdXSwicGlfYyI6WyIxNjA5MDYyODcyNDI5NDc4NTI4NDM5ODc3MjY2MzI4NDUyOTg4NTc0NjE1MTQ0NjY4NDYzNjE4NjY4OTkzMjk5NjUxODM0MzY2MDM1OSIsIjIwNTQ4MTYwOTUyMTA1ODcyMjU4NDI4MjE3MjM1ODA2NDI3OTI4NTM2Njc0NDIzOTU5NTExNTA1MzcwNTQ1MDUzNTcyODcwMzc0MTMxIiwiMSJdLCJwcm90b2NvbCI6Imdyb3RoMTYiLCJjdXJ2ZSI6ImJuMTI4In0sInB1Yl9zaWduYWxzIjpbIjIxMDIzMDE1MzY5NTcyNzQ5NDc2ODkwNjA4NDMzMzMxNjc4Mzk0MDU3ODg3MzY2MTEzNjE2NDYxMDY5NjQzNTQ3Njk1OTc3MjE3IiwiNzcyOTc2NzgwNjc5MjAyNTc2NjU5Njc2OTg4MzE3NDc0MDUzNzQzMzU2NDIwOTA1OTA2MzcwODE0MDU1OTQyMjAwODA2NTM3MzQ2MyIsIjU2MDQ2MzY2MDQzNDE2MTYxNzM4NTEzMDEzMzQ1NTMyODMxNjM2MzgxNDgzMzA0MTgxMzk0MTk5MDY0Nzg4ODc4NDIxNzczODE4MzYiXX0
```

issuer sent claim

```json
{
    "body": {
        "credential": {
            "id": "urn:uuid:ccd39a28-415b-11f0-acd0-0a58a9feac02",
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://schema.iden3.io/core/jsonld/iden3proofs.jsonld",
                "ipfs://QmdH1Vu79p2NcZLFbHxzJnLuUHJiMZnBeT7SNpLaqK7k9X"
            ],
            "type": [
                "VerifiableCredential",
                "POAP01"
            ],
            "issuanceDate": "2025-06-04T15:51:38.274530742Z",
            "credentialSubject": {
                "city": "Paris",
                "id": "did:iden3:polygon:amoy:xBZmt1D3aeYokyP5DxwpYnSufcpPSHyZPszFm9XSi",
                "type": "POAP01"
            },
            "credentialStatus": {
                "id": "did:iden3:polygon:amoy:xG3SpbMvA3uUnGYDn1WydkpfKq3Kjtv2pWNAwj8k5/credentialStatus?revocationNonce=2269751169\u0026contractAddress=80002:0x3d3763eC0a50CE1AdF83d0b5D99FBE0e3fEB43fb\u0026state=22b22fb23a0c9d98b09e058822e4e4259f52a3f485f02cc947856fde14a7ab08",
                "revocationNonce": 2269751169,
                "type": "Iden3OnchainSparseMerkleTreeProof2023"
            },
            "issuer": "did:iden3:polygon:amoy:xG3SpbMvA3uUnGYDn1WydkpfKq3Kjtv2pWNAwj8k5",
            "credentialSchema": {
                "id": "ipfs://QmTSwnuCB9grYMB2z5EKXDagfChurK5MiMCS6efrRbsyVX",
                "type": "JsonSchema2023"
            },
            "proof": [
                {
                    "type": "Iden3SparseMerkleTreeProof",
                    "issuerData": {
                        "id": "did:iden3:polygon:amoy:xG3SpbMvA3uUnGYDn1WydkpfKq3Kjtv2pWNAwj8k5",
                        "state": {
                            "txId": "0xc5fe6a1482d447188016cac807d7f7bee2c7a70e5fc2ac29fde07e3c6e9250ff",
                            "blockTimestamp": 1749052329,
                            "blockNumber": 22500367,
                            "rootOfRoots": "f7cb328170d4b82a15ff6dbcc4c1d0af9c503541200c3ca291fb76f2c495f224",
                            "claimsTreeRoot": "2f7c1f8150996e2726233356355faf0cb8bdcdb3ea1b5b881a67bbb3bd8c7323",
                            "revocationTreeRoot": "0000000000000000000000000000000000000000000000000000000000000000",
                            "value": "7806ae01070be59386a7fc138853dca92c5465e67e3a36058dc5bc19b2ca0205"
                        }
                    },
                    "coreClaim": "1149366adf462264c0c0450644e765d822000000000000000000000000000000011365aa894b7c4de8a52d367526155e133dad105eecb7e51474a9fa0ae60b00a0c224a33526cb38f477cbe453bb853e17179fefd38f1d13fc304d806dc0fa0b000000000000000000000000000000000000000000000000000000000000000081a7498700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
                    "mtp": {
                        "existence": true,
                        "siblings": [
                            "20737350969482875974616286911526456599464285876673155931041537544665126271620",
                            "1021166799168800772344109792713876265689120777060494081543962926690046824041"
                        ]
                    }
                }
            ]
        }
    },
    "from": "did:iden3:polygon:amoy:xG3SpbMvA3uUnGYDn1WydkpfKq3Kjtv2pWNAwj8k5",
    "id": "f3d0909a-4209-49fe-86d1-62d7c6cdd1df",
    "threadID": "90f60f01-963d-41fa-a9ce-7de0ce84057a",
    "to": "did:iden3:polygon:amoy:xBZmt1D3aeYokyP5DxwpYnSufcpPSHyZPszFm9XSi",
    "typ": "application/iden3comm-plain-json",
    "type": "https://iden3-communication.io/credentials/1.0/issuance-response"
}
```

---

# Demo

# Web

![image.png](image.png)

## Connect MetaMask

Click `Connect wallet`  button.

![image.png](image%201.png)

## Change MetaMask Address

On MetaMask Extension.

# Loan Market

![Mermaid Chart - Create complex, visual diagrams with text. A smarter way of creating diagrams.-2025-07-03-180430.png](Mermaid_Chart_-_Create_complex_visual_diagrams_with_text._A_smarter_way_of_creating_diagrams.-2025-07-03-180430.png)

# Borrower

## Borrowers create loan app

1. Select type of loan.
2. Input loan detail.
3. Click `Request Loan` button.

![image.png](image%202.png)

## Borrowers send their loan app to prefer lender

![Mermaid Chart - Create complex, visual diagrams with text. A smarter way of creating diagrams.-2025-07-03-174407.png](Mermaid_Chart_-_Create_complex_visual_diagrams_with_text._A_smarter_way_of_creating_diagrams.-2025-07-03-174407.png)

1. select loan

![image.png](image%203.png)

1. input lender address

![image.png](image%204.png)

1. Input each Lender’s required ZKP request ID and Click Generate Credential.

![image.png](image%205.png)

1. In wallet, send your proof.

![image.png](image%206.png)

1. After send all Required, Click `Apply to Lender for Loan ..` For send your Loan to lender.

![image.png](image%207.png)

## Review Lender Offer and Accept

1. Choose a offer and accept it.

![image.png](image%208.png)

## Credit Loan

![Mermaid Chart - Create complex, visual diagrams with text. A smarter way of creating diagrams.-2025-07-03-174629.png](Mermaid_Chart_-_Create_complex_visual_diagrams_with_text._A_smarter_way_of_creating_diagrams.-2025-07-03-174629.png)

### Select Loan id

![image.png](image%209.png)

### Draw

Input token amount to draw from loan.

![image.png](image%2010.png)

![image.png](image%2011.png)

### Repay

Input token amount to repay loan.

![image.png](image%2012.png)

![image.png](image%2013.png)

## Personal Loan

![Mermaid Chart - Create complex, visual diagrams with text. A smarter way of creating diagrams.-2025-07-03-174545.png](Mermaid_Chart_-_Create_complex_visual_diagrams_with_text._A_smarter_way_of_creating_diagrams.-2025-07-03-174545.png)

### Token added to borrower after lender fund

### Repay Loan (Installment)

![image.png](image%2014.png)

![image.png](image%2015.png)

# Lender

## Register

1. Click to register. 

![image.png](image%2016.png)

## **Setting Proof**

### Create proof on Universal Verify Contract and get proofID

- Using https://tools.privado.id/query-builder
- Using Hardhat script `setProofRequest.ts`

set on web and input data to web backend

![image.png](image%2017.png)

```json
{
    "body": {
        "reason": "for testing purposes",
        "scope":
[
  {
    "circuitId": "credentialAtomicQueryMTPV2OnChain",
    "id": 1749753999,
    "query": {
      "allowedIssuers": [
        "*"
      ],
      "context": "ipfs://QmdH1Vu79p2NcZLFbHxzJnLuUHJiMZnBeT7SNpLaqK7k9X",
      "credentialSubject": {
        "city": {
          "$eq": "Paris"
        }
      },
      "type": "POAP01"
    }
  }
],
        "transaction_data": {
            "chain_id": 80002,
            "contract_address": "0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c",
            "method_id": "0xade09fcd",
            "network": "polygon-amoy"
        }
    },
    "from": "did:iden3:polygon:amoy:x6x5sor7zpyefHwZu9RE4xiuRWBkq9xAEHxrKbKWb",
    "id": "a5568008-dff0-4cf0-ba0b-8deed77a8218",
    "thid": "a5568008-dff0-4cf0-ba0b-8deed77a8218",
    "typ": "application/iden3comm-plain-json",
    "type": "https://iden3-communication.io/proofs/1.0/contract-invoke-request"
}
```

## Review Loan

Submit or Reject the loan.

1. if submit, Input your offer to the loan.

![image.png](image%2018.png)

## Fund Loan

### Approve token and fund

Click Approve token and fund loan.

![image.png](image%2019.png)

# Vault Manager [ERC-4626: Tokenized Vaults](https://eips.ethereum.org/EIPS/eip-4626)

Create Vault and Manage it.

### ERC-4626

To standardize Vaults. 

### Convert

Assets: ERC-20 Token

`shares = assets * (totalSupply + 10^offset) / (totalAssets + 1)`

`assets = shares * (totalAssets + 1) / (totalSupply + 10^offset)`

Example:

- Deposit 100 tokens to Vault at $shares/supply = 1$ will get 100 share
- The Vault get profit $shares/supply = 1.2$
- Withdraw 100 shares will get 120 tokens.

## **Create Vault**

Only Admin (on Vault manager contract).

- Select ERC-20 Token
- Set IDEN3 Request ID (optional)

![image.png](image%2020.png)

## **Deposit / Withdraw**

- select Vault by Vault ID ( in LOG when created)

### Deposit

1. Input token amount to deposit
2. Approve it.
3. Deposit it.

### Withdraw

1. Input shares to withdraw
2. The Caller approve that share (ERC-20, address of Vault) to Vault Manager address.
3. Click Withdraw.

![image.png](image%2021.png)

## Fund Loan

For call approve and fund loan to the Loan contract.

- Input Vault ID
- Input Loan address

![image.png](image%2022.png)

# Token

To Interact with ERC-20 Token.

## Token

- Select any ERC-20 token
- Approved and Transfer

![image.png](image%2023.png)

# Deploy

For manual deploy loan without LoanMarket.

## Manuals deploy loan

![image.png](image%2024.png)