# Component Story Flows

This document lists the main user stories in the web app and the smart contract functions each React component calls.

## Borrower Flow
1. **Request a Loan** (`BorrowerView`)
   - Calls `requestLoan` on the `LoanMarket` contract using `requestLoanWrite`.
2. **Apply to a Lender** (`BorrowerView`)
   - Calls `sendLoanApplication` with the selected lender via `sendLoanApplicationWrite`.
3. **Accept an Offer** (`BorrowerView`)
   - Uses `acceptOfferWrite` to call `acceptOffer` once a lender makes an offer.
4. **Repay the Loan** (`BorrowerView`)
   - After a credit loan is deployed, `repayLoanWrite` calls the loan's `repay` function.

## Lender Flow
1. **Register as Lender** (`LenderView`)
   - `registerLenderWrite` invokes `registerLender` on `LoanMarket`.
2. **Set Required Proofs** (`LenderView`)
   - `setRequiredProofsWrite` submits proof IDs via `setRequiredProofs`.
3. **Submit an Offer** (`LenderView`)
   - `submitOfferWrite` calls `submitOffer` for a borrower’s request.
4. **Fund the Loan**
   - Once an offer is accepted and a loan contract is deployed, funding happens through the loan contract.
   - `PersonalLoanView` uses `fundLoanWrite` (calls `fundLoan`).
   - `CreditLoanView` exposes `drawWrite` for borrowers to draw funds and `repayWrite` for repayment.

## Loan Interaction Flow
- **Personal Loans** (`PersonalLoanView`)
  - `fundLoanWrite` -> `fundLoan` to send funds to the borrower.
  - `makePaymentWrite` -> `makeInstallmentPayment` to repay installments.
- **Credit Loans** (`CreditLoanView`)
  - `drawWrite` -> `draw` to withdraw available credit.
  - `repayWrite` -> `repay` to repay outstanding balance.
