// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title ILoan
 * @notice The interface for all loan contracts created by the LoanMarket.
 */
interface ILoan {
    function fundLoan() external;
    function state() external view returns (address borrower, address lender, uint256 principal, uint256 interestBps, uint256 dueDate, bool isFunded, bool isRepaid);
}