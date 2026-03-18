export type ClaimStatus =
  | "draft"
  | "reviewing"
  | "submitting"
  | "submitted"
  | "skipped"
  | "failed";

export type ClaimItem = {
  description: string;
  serviceDate: Date;
  amount: number; // cents
  expenseType: string; // Navia dropdown value, e.g. "OTC"
};

export type Claim = {
  id: string;
  sourceOrderId: string;
  items: ClaimItem[];
  totalAmount: number; // cents
  invoiceDataUrl: string; // base64 JPEG
  status: ClaimStatus;
  errorMessage?: string;
  createdAt: Date;
  submittedAt?: Date;
};
