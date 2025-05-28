import { CircuitStorage, IndexedDBDataSource } from '@0xpolygonid/js-sdk';
export class CircuitStorageInstance {
  static async init() {
    if (!this.instanceCS) {
      this.instanceCS = new CircuitStorage(
        new IndexedDBDataSource("circuits")
      );
      try {
        console.time("check loading circuits from DB");
        await this.instanceCS.loadCircuitData("authV2");
        console.timeEnd("check loading circuits from DB");
        return this.instanceCS;
      } catch (e) {
        console.time("CircuitStorageInstance.init");
        const auth_w = await fetch("./AuthV2/circuit.wasm")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const mtp_w = await fetch("./credentialAtomicQueryMTPV2/circuit.wasm")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const sig_w = await fetch("./credentialAtomicQuerySigV2/circuit.wasm")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const v3_w = await fetch("./credentialAtomicQueryV3-beta.1/circuit.wasm")
        .then((response) => response.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
        const st_w = await fetch("./stateTransition/circuit.wasm")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const mtpOV2_w = await fetch("./credentialAtomicQueryMTPV2OnChain/circuit.wasm")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));

        const auth_z = await fetch("./AuthV2/circuit_final.zkey")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const mtp_z = await fetch(
          "./credentialAtomicQueryMTPV2/circuit_final.zkey"
        )
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const sig_z = await fetch(
          "./credentialAtomicQuerySigV2/circuit_final.zkey"
        )
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
          const v3_z = await fetch("./credentialAtomicQueryV3-beta.1/circuit_final.zkey")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const st_z = await fetch("./stateTransition/circuit_final.zkey")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const mtpOV2_z = await fetch("./credentialAtomicQueryMTPV2OnChain/circuit_final.zkey")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));

        const auth_j = await fetch("./AuthV2/verification_key.json")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const mtp_j = await fetch(
          "./credentialAtomicQueryMTPV2/verification_key.json"
        )
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const sig_j = await fetch(
          "./credentialAtomicQuerySigV2/verification_key.json"
        )
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const v3_j = await fetch("./credentialAtomicQueryV3-beta.1/verification_key.json")
        .then((response) => response.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
        const st_j = await fetch("./stateTransition/verification_key.json")
          .then((response) => response.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        const mtpOV2_j = await fetch("./credentialAtomicQueryMTPV2OnChain/verification_key.json")
        .then((response) => response.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));

        console.timeEnd("CircuitStorageInstance.init");
        // this.instanceCS = new CircuitStorage(new InMemoryDataSource());
        console.time("CircuitStorageInstance.saveCircuitData");
        await this.instanceCS.saveCircuitData("authV2", {
          circuitId: "authV2".toString(),
          wasm: auth_w,
          provingKey: auth_z,
          verificationKey: auth_j,
        });
        await this.instanceCS.saveCircuitData("credentialAtomicQueryMTPV2", {
          circuitId: "credentialAtomicQueryMTPV2".toString(),
          wasm: mtp_w,
          provingKey: mtp_z,
          verificationKey: mtp_j,
        });
        await this.instanceCS.saveCircuitData("credentialAtomicQuerySigV2", {
          circuitId: "credentialAtomicQuerySigV2".toString(),
          wasm: sig_w,
          provingKey: sig_z,
          verificationKey: sig_j,
        });
        await this.instanceCS.saveCircuitData("credentialAtomicQueryV3-beta.1", {
          circuitId: "credentialAtomicQueryV3-beta.1".toString(),
          wasm: v3_w,
          provingKey: v3_z,
          verificationKey: v3_j,
        });
        await this.instanceCS.saveCircuitData("stateTransition", {
          circuitId: "stateTransition".toString(),
          wasm: st_w,
          provingKey: st_z,
          verificationKey: st_j,
        });
        await this.instanceCS.saveCircuitData("credentialAtomicQueryMTPV2OnChain", {
          circuitId: "credentialAtomicQueryMTPV2OnChain".toString(),
          wasm: mtpOV2_w,
          provingKey: mtpOV2_z,
          verificationKey: mtpOV2_j,
        });
        console.timeEnd("CircuitStorageInstance.saveCircuitData");
      }
    }
  }

  static getCircuitStorageInstance() {
    return this.instanceCS;
  }
}
