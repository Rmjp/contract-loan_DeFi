// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UniversalVerifier} from '@iden3/contracts/verifiers/UniversalVerifier.sol'; // Or import IZKPVerifier and use the interface

contract Verifiable {
    UniversalVerifier public verifier; // Made public for LoanContract to access

    // The modifier as you defined it
    modifier isVerified(uint64 requestId, address target) {
        UniversalVerifier.ProofStatus memory proofStatus = verifier.getProofStatus(target, requestId);
        require(proofStatus.isVerified, 'Verifiable: target is not verified');
        _;
    }

    constructor(UniversalVerifier verifier_) {
        require(address(verifier_) != address(0), "Verifiable: Verifier address cannot be zero");
        verifier = verifier_;
    }

    // Optional: A view function might be cleaner for internal checks if you don't want to use the modifier directly in loops
    function checkProofStatus(uint64 requestId, address target) internal view returns (bool) {
        UniversalVerifier.ProofStatus memory proofStatus = verifier.getProofStatus(target, requestId);
        return proofStatus.isVerified;
    }
}