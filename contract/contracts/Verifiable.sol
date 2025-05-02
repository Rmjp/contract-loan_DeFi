// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @notice Interface for an on-chain ZKP verifier
interface IVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) external view returns (bool);
}

/// @notice Verifiable Presentation (VP) structure for ZKP inputs
struct VP {
    uint256[2]    a;
    uint256[2][2] b;
    uint256[2]    c;
    uint256[]     input;
}

/**
 * @title Verifiable
 * @dev Manages a registry of ZKP verifier contracts and exposes a unified `verify` API.
 *      Access control for registry modifications is owned by the contract owner.
 */
contract Verifiable is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private _verifiers;

    /// @notice Emitted when a new verifier is registered
    event VerifierAdded(address indexed verifier);
    /// @notice Emitted when an existing verifier is removed
    event VerifierRemoved(address indexed verifier);

    /**
     * @dev Initializes a new instance of Ownable.
     */
    constructor() Ownable() { }

    /**
     * @notice Register a new on-chain ZKP verifier contract
     * @param verifier The address of a contract implementing IVerifier
     */
    function addVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Verifiable: zero address");
        require(_verifiers.add(verifier), "Verifiable: already registered");
        emit VerifierAdded(verifier);
    }

    /**
     * @notice Unregister a verifier contract
     * @param verifier The address to remove
     */
    function removeVerifier(address verifier) external onlyOwner {
        require(_verifiers.remove(verifier), "Verifiable: not registered");
        emit VerifierRemoved(verifier);
    }

    /**
     * @notice Check if an address is a registered verifier
     * @param verifier The address to check
     * @return True if registered
     */
    function isVerifier(address verifier) external view returns (bool) {
        return _verifiers.contains(verifier);
    }

    /**
     * @notice Get the full list of registered verifier addresses
     * @return Array of verifier addresses
     */
    function getVerifiers() external view returns (address[] memory) {
        return _verifiers.values();
    }

    /**
     * @notice Verify a proof via a registered verifier
     * @param verifier The address of the verifier contract
     * @param vp The verifiable presentation data
     * @return True if the proof checks out
     */
    function verify(address verifier, VP calldata vp) public view returns (bool) {
        // require(_verifiers.contains(verifier), "Verifiable: verifier not found");
        return IVerifier(verifier).verifyProof(vp.a, vp.b, vp.c, vp.input);
    }

    // === Example state info ===
    struct StateInfo {
        uint256 id;
        uint256 state;
        uint256 replacedByState;
        uint256 createdAtTimestamp;
        uint256 replacedAtTimestamp;
        uint256 createdAtBlock;
        uint256 replacedAtBlock;
    }

    /**
     * @notice (Optional) Mocked getter for a hardcoded state
     * @dev Retained for backward compatibility but can be overridden by a real storage solution
     */
    function getStateInfoById(uint256 id) external pure returns (StateInfo memory) {
        if (
            id == 23059336182092717530402538631517012974515776249001969233049292365119689217  /* example 256-bit ID */
        ) {
            return StateInfo({
                id: id,
                state: 288648600274475711174233815269229986964406022137315219531346496269730274570,
                replacedByState: 0,
                createdAtTimestamp: 1714400000,
                replacedAtTimestamp: 0,
                createdAtBlock: 18_000_000,
                replacedAtBlock: 0
            });
        }
        return StateInfo({
            id: 0,
            state: 0,
            replacedByState: 0,
            createdAtTimestamp: 0,
            replacedAtTimestamp: 0,
            createdAtBlock: 0,
            replacedAtBlock: 0
        });
    }
}
