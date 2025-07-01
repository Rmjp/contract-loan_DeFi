import creditLoanArtifact from './artifacts/CreditLoan.json';
import personalLoanArtifact from './artifacts/PersonalLoan.json';

export const CREDIT_LOAN_BYTECODE = (creditLoanArtifact as any).bytecode as `0x${string}`;
export const PERSONAL_LOAN_BYTECODE = (personalLoanArtifact as any).bytecode as `0x${string}`;
