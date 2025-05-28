import { RHS_URL } from "../constants";
import { ExtensionService } from "./Extension.service";
import { CredentialStatusType, NativeProver } from "@0xpolygonid/js-sdk";
import { CircuitStorageInstance } from './CircuitStorage';

export class IdentityServices {
  static instanceIS;
  static async createIdentity() {
    if (!this.instanceIS) {
      const { wallet, signer } = ExtensionService.getExtensionServiceInstance();

      const identity = await wallet.createIdentity({
        method: 'iden3',
        blockchain: 'polygon',
        networkId: 'amoy',
        revocationOpts: {
          type: CredentialStatusType.Iden3OnchainSparseMerkleTreeProof2023,
          id: RHS_URL,
          onChain: true,
        }
      });
      // const { did } = identity;
      // const oldTree = await wallet.getDIDTreeModel(did);
      // const oldTreeState = {
      //   state: oldTree.state,
      //   claimsRoot: await (oldTree.claimsTree.root()),
      //   revocationRoot: await (oldTree.revocationTree.root()),
      //   rootOfRoots: await (oldTree.rootsTree.root()),
      // };
      // console.log('Old tree state:', oldTreeState);
      // const isOldStateGenesis = true; // true for the first time
      // const circuitStorage = CircuitStorageInstance.getCircuitStorageInstance();
      // const prover = new NativeProver(circuitStorage);
      // const txId = await wallet.transitState(
      //   did,
      //   oldTreeState,
      //   isOldStateGenesis,
      //   signer,
      //   prover
      // );
      // console.log('Transaction ID from state transition:', txId);

      console.log("!!!!!!!!!!!!!!!!", identity);
      this.instanceIS = identity;
      return this.instanceIS;
    } else return this.instanceIS;
  }

  static getIdentityInstance() {
    return this.instanceIS;
  }
}
