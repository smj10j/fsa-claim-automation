export type BenefitYear = {
  year: number;
  start: Date;
  end: Date;
  label: string;
};

export type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number; // cents
  totalPrice: number; // cents
  category?: string;
  imageUrl?: string;
  isEligible: boolean;
  eligibilityReason?: string;
};

export type InvoiceStatus = "pending" | "captured" | "failed";

export type AmazonOrder = {
  orderId: string;
  orderDate: Date;
  totalAmount: number; // cents
  items: OrderItem[];
  eligibleItems: OrderItem[];
  invoiceStatus: InvoiceStatus;
  orderDetailUrl: string;
};
