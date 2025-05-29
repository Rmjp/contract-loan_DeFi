import axios from "axios";
import { ExtensionService } from "./Extension.service";
import { LocalStorageServices } from './LocalStorage.services';
import { AuthHandler, FetchHandler, core } from '@0xpolygonid/js-sdk';
import { ethers } from "ethers";
const { DID } = core;

export async function approveMethod(msgBytes) {
  const { packageMgr, proofService, credWallet } = ExtensionService.getExtensionServiceInstance();

  let authHandler = new AuthHandler(packageMgr, proofService, credWallet);
  let _did = DID.parse(LocalStorageServices.getActiveAccountDid());
  const authRes = await authHandler.handleAuthorizationRequest(_did, msgBytes);
  console.log(JSON.stringify(authRes));
  const config = {
    headers: {
      'Content-Type': 'text/plain'
    },
    responseType: 'json'
  };
  return await axios
    .post(`${authRes.authRequest.body.callbackUrl}`, authRes.token, config)
    .then((response) => response)
    .catch((error) => error.toJSON());
}

export async function receiveMethod(msgBytes) {
  const { packageMgr, credWallet } = ExtensionService.getExtensionServiceInstance();
  let fetchHandler = new FetchHandler(packageMgr);
  const credentials = await fetchHandler.handleCredentialOffer(msgBytes);
  console.log(credentials);
  await credWallet.saveAll(credentials);
  return 'SAVED';
}

export async function proofMethod(msgBytes) {
  const { authHandler } = ExtensionService.getExtensionServiceInstance();
  const authRequest = await authHandler.parseAuthorizationRequest(msgBytes);
  const { body } = authRequest;
  const { scope = [] } = body;
  if (scope.length > 1) {
    throw new Error("not support 2 scope");
  }
  const did = DID.parse(LocalStorageServices.getActiveAccountDid());
  const response = await authHandler.handleAuthorizationRequest(
    did,
    msgBytes,
  );
  var config = {
    headers: {
      'Content-Type': 'text/plain'
    },
    responseType: 'json'
  };
  return await axios
    .post(`${authRequest.body.callbackUrl}`, response.token, config)
    .then((response) => response)
    .catch((error) => error.toJSON());
}

// Helper function to convert a hex string to a Uint8Array
function hexToBytes(hex) {
    // Remove '0x' prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
}

// Helper function to convert a Uint8Array to a hex string
function bytesToHex(bytes) {
    return '0x' + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Helper function to reverse a Uint8Array
function reverseBytes(bytes) {
    return new Uint8Array([...bytes].reverse());
}

export async function proofMethodOnChain(msgBytes) {
    const { contractRequestHandler, signer } = await ExtensionService.getExtensionServiceInstance();

    // Parse the contract invoke request
    const ciRequest = (await (contractRequestHandler).parseContractInvokeRequest(msgBytes));

    const { body } = ciRequest;
    const { scope = [] } = body;

    if (scope.length > 1) {
        throw new Error("Only one scope is supported for on-chain proof submission.");
    }

    const did = DID.parse(LocalStorageServices.getActiveAccountDid());

    const addressBytes20 = hexToBytes(signer.address);
    const paddedBytes32 = new Uint8Array(32);
    paddedBytes32.set(addressBytes20, 12);
    const reversedPaddedBytes32 = reverseBytes(addressBytes20);
    const challenge = ethers.toBigInt(bytesToHex(reversedPaddedBytes32));
    
    
    console.log("Challenge:", challenge);
    const options = {
      senderDid: did,
      ethSigner: signer,
      challenge,
    };

    // Handle the contract invoke request, which will involve on-chain transactions
    const ciResponse = await contractRequestHandler.handle(
        ciRequest,
        options
    );

    // The response from handle() will be a BasicMessage, which for a CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE
    // will be a ContractInvokeResponse.
    const contractInvokeResponse = ciResponse;


    var config = {
        headers: {
            'Content-Type': 'application/json' // Assuming the response token is JSON, adjust if plain text
        }
    };
    if (!ciRequest.body.callbackUrl) {
        throw new Error("Callback URL not found in the contract invoke request body.");
    }

    // Convert the Map<string, ZeroKnowledgeInvokeResponse> to a serializable format if needed for the callback.
    // For simplicity, directly using the contractInvokeResponse which should be serializable.
    return await axios
        .post(`${ciRequest.body.callbackUrl}`, contractInvokeResponse, config)
        .then((response) => response)
        .catch((error) => {
            console.error('Error posting to callback URL:', error);
            throw error; // Re-throw the error after logging
        });
}