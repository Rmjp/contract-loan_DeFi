// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InterestCalculator
 * @notice A library for handling common interest calculations for loan contracts.
 * @dev All functions are pure and can be used without deploying the library.
 */
library InterestCalculator {
    uint256 private constant BPS_DIVISOR = 10000;
    uint256 private constant SECONDS_IN_YEAR = 365 days;
    uint256 private constant WAD = 1e18; // For fixed-point math precision

    /**
     * @notice Calculates simple interest for a fixed term (P * r * t).
     */
    function calculateSimpleInterest(
        uint256 principal,
        uint256 interestBps,
        uint256 termInSeconds
    ) internal pure returns (uint256) {
        return (principal * interestBps * termInSeconds) / (BPS_DIVISOR * SECONDS_IN_YEAR);
    }

    /**
     * @notice Calculates interest accrued over a specific period of time.
     */
    function calculateAccruedInterest(
        uint256 outstandingBalance,
        uint256 interestBps,
        uint256 timeElapsed
    ) internal pure returns (uint256) {
        // Round timeElapsed to days to avoid precision issues
        timeElapsed = roundToDay(timeElapsed);
        return (outstandingBalance * interestBps * timeElapsed) / (BPS_DIVISOR * SECONDS_IN_YEAR);
    }

    /**
     * @notice Calculates the fixed periodic payment for an installment loan (amortization).
     * @param principal The total loan amount.
     * @param interestBps The annual interest rate in basis points.
     * @param numberOfPayments The total number of payments to be made.
     * @param paymentInterval The duration of each payment period in seconds.
     * @return The fixed amount to be paid each period.
     */
    function calculateInstallmentPayment(
        uint256 principal,
        uint256 interestBps,
        uint256 numberOfPayments,
        uint256 paymentInterval
    ) internal pure returns (uint256) {
        if (interestBps == 0) {
            return principal / numberOfPayments;
        }

        // Calculate the periodic interest rate with high precision
        uint256 periodicRateWad = (interestBps * WAD * paymentInterval) / (BPS_DIVISOR * SECONDS_IN_YEAR);
        
        uint256 rPlusOne = periodicRateWad + WAD;
        uint256 rPlusOnePowN = _pow(rPlusOne, numberOfPayments);

        // Amortization formula: A = P * [r * (1+r)^n] / [(1+r)^n - 1]
        uint256 numerator = principal * periodicRateWad * rPlusOnePowN / WAD;
        uint256 denominator = rPlusOnePowN - WAD;

        return numerator / denominator;
    }

    /**
     * @notice Internal power function (exponentiation by squaring) for fixed-point numbers.
     * @dev Calculates (base/WAD)^exponent * WAD.
     */
    function _pow(uint256 base, uint256 exponent) private pure returns (uint256) {
        uint256 result = WAD;
        while (exponent > 0) {
            if (exponent % 2 == 1) {
                result = (result * base) / WAD;
            }
            base = (base * base) / WAD;
            exponent /= 2;
        }
        return result;
    }

    function roundToDay(uint256 timestamp) public pure returns (uint256) {
        return (timestamp / 1 days) * 1 days;
    }
}
