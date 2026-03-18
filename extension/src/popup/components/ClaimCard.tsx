import type { Claim } from "@/types";

interface Props {
  claim: Claim;
  invoiceDataUrl?: string;
  onFill: (claimId: string) => void;
  onSkip: (claimId: string) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ClaimCard({ claim, invoiceDataUrl, onFill, onSkip }: Props) {
  const firstItem = claim.items[0];

  return (
    <div className="p-4 space-y-3">
      <div className="space-y-1">
        <div className="font-semibold text-sm">
          {firstItem?.description ?? "FSA Purchase"}
        </div>
        <div className="text-xs text-gray-500">
          Service Date: {firstItem ? formatDate(firstItem.serviceDate) : "—"}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Type: {firstItem?.expenseType ?? "—"}
          </span>
          <span className="font-semibold text-base font-mono">
            {formatCents(claim.totalAmount)}
          </span>
        </div>
      </div>

      {invoiceDataUrl && (
        <div className="border rounded overflow-hidden">
          <img
            src={invoiceDataUrl}
            alt="Invoice"
            className="w-full h-32 object-cover object-top"
          />
        </div>
      )}

      {claim.status === "failed" && claim.errorMessage && (
        <div className="text-xs text-red-600 bg-red-50 rounded p-2">
          Error: {claim.errorMessage}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onSkip(claim.id)}
          className="flex-1 py-2 px-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={() => onFill(claim.id)}
          disabled={claim.status === "submitting"}
          className="flex-1 py-2 px-3 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {claim.status === "submitting" ? "Filling..." : "Fill & Review"}
        </button>
      </div>
    </div>
  );
}
