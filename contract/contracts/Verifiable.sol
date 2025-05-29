// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// It's good practice to use the interface type for external contracts when possible,
// or the concrete contract type if you are sure it's what you need.
// The @iden3/contracts UniversalVerifier is a concrete contract.
import {UniversalVerifier} from "./UniversalVerifier/verifiers/UniversalVerifier.sol";
// import {IZKPVerifier} from "@iden3/contracts/interfaces/IZKPVerifier.sol";

contract Verifiable is Initializable {
    UniversalVerifier public verifier;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function __Verifiable_init(address verifierAddress) internal onlyInitializing {
        require(verifierAddress != address(0), "Verifiable: Verifier address cannot be zero");
        verifier = UniversalVerifier(verifierAddress);
    }

    // Your isVerified modifier, adapted to use the public state variable `verifier`
    // Note: Modifiers cannot directly return values or be easily used in loops for checks.
    // It's often better to have a view function for checks within loops.
    modifier isVerified(uint64 requestId, address target) {
        UniversalVerifier.ProofStatus memory proofStatus = verifier.getProofStatus(target, requestId);
        require(proofStatus.isVerified, "Verifiable: Target is not verified.");
        _;
    }

    // Public view function to check proof status, callable by inheriting contracts
    function checkProofIsVerified(uint64 requestId, address target) public view returns (bool) {
        UniversalVerifier.ProofStatus memory proofStatus = verifier.getProofStatus(target, requestId);
        return proofStatus.isVerified;
    }

    // Placeholder for a potential versioning function if needed by OZ Upgrades (usually not required for simple cases)
    // function version() external pure returns (string memory) {
    //     return "1.0.0";
    // }
}
