export type VP = [
  [bigint, bigint],  // a
  [[bigint, bigint], [bigint, bigint]],  // b
  [bigint, bigint],  // c
  bigint[]  // input
];

export interface Offer {
  lender: string;
  interestOffered: bigint;
}

export interface Loan {
  borrower: string;
  lender: string;
  token: string;
  amountRequested: bigint;
  interest: bigint;
  dueDate: bigint;
  funded: boolean;
  repaid: boolean;
  offers: Offer[];
} 