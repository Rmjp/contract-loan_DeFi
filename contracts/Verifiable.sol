// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) external view returns (bool);
}

contract Verifiable {

    struct Verifier{
        address addr;
    }

    struct VP{
        uint256[2]      a;
        uint256[2][2]   b;
        uint256[2]      c;
        uint256[]       input;
    }

    mapping(address => Verifier) public verifiers;

    function addVerifier(address addr) external { 
        require(verifiers[addr].addr == address(0)); // ensure verifier is not registered
        verifiers[addr] = Verifier({
            addr: addr
        });
    }

    function verify(address addr, VP memory vp) view  public returns (bool) {
        require(verifiers[addr].addr != address(0)); // ensure verifier is registered
        
        return IVerifier(verifiers[addr].addr).verifyProof(vp.a, vp.b, vp.c, vp.input);
    }


    struct StateInfo {
        uint256 id;
        uint256 state;
        uint256 replacedByState;
        uint256 createdAtTimestamp;
        uint256 replacedAtTimestamp;
        uint256 createdAtBlock;
        uint256 replacedAtBlock;
    }
    
    function getStateInfoById(uint256 id) external view returns (StateInfo memory) {
        // Only handle the specific mocked ID
        if (
            id == 23059336182092717530402538631517012974515776249001969233049292365119689217
        ) {
            return StateInfo({
                id: id,
                state: 288648600274475711174233815269229986964406022137315219531346496269730274570,
                replacedByState: 0,
                createdAtTimestamp: 1714400000, // mock timestamp
                replacedAtTimestamp: 0,
                createdAtBlock: 18000000, // mock block
                replacedAtBlock: 0
            });
        }

        // If ID is not found, return empty struct
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