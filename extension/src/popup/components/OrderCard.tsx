import type { AmazonOrder, NaviaExpense } from "@/types";

interface Props {
  order: AmazonOrder;
  selected: boolean;
  onToggle: (orderId: string) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CoverageTag({ expense }: { expense: NaviaExpense }) {
  const styles: Record<string, string> = {
    covered: "bg-green-100 text-green-700",
    lmn: "bg-yellow-100 text-yellow-700",
    prescription: "bg-blue-100 text-blue-700",
    "not-covered": "bg-red-100 text-red-600",
  };
  const labels: Record<string, string> = {
    covered: "Covered",
    lmn: "Needs LMN",
    prescription: "Needs Rx",
    "not-covered": "Not covered",
  };

  const tooltip = expense.notes ? `${expense.name}: ${expense.notes}` : expense.name;
  return (
    <span
      className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles[expense.status]}`}
      title={tooltip}
    >
      {labels[expense.status]} · {expense.name}
    </span>
  );
}

export function OrderCard({ order, selected, onToggle }: Props) {
  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-all ${
        selected
          ? "border-blue-400 bg-blue-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
      onClick={() => onToggle(order.orderId)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(order.orderId)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-gray-500">
              {formatDate(order.orderDate)} · #{order.orderId}
            </div>
            <div className="font-medium text-xs mt-0.5 truncate">
              {order.eligibleItems[0]?.title ?? "Unknown item"}
              {order.eligibleItems.length > 1 && (
                <span className="text-gray-400">
                  {" "}+{order.eligibleItems.length - 1} more
                </span>
              )}
            </div>
            {/* Coverage tags — one per unique Navia expense in this order */}
            <div className="flex flex-wrap gap-1 mt-1">
              {Array.from(
                new Map(
                  order.eligibleItems
                    .filter((i) => i.naviaExpense)
                    .map((i) => [i.naviaExpense!.name, i.naviaExpense!])
                ).values()
              ).map((expense) => (
                <CoverageTag key={expense.name} expense={expense} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-semibold text-sm font-mono">
            {formatCents(order.totalAmount)}
          </div>
          <div
            className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 ${
              order.invoiceStatus === "captured"
                ? "bg-green-100 text-green-700"
                : order.invoiceStatus === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {order.invoiceStatus === "captured"
              ? "Receipt ✓"
              : order.invoiceStatus === "failed"
              ? "Capture failed"
              : "No receipt"}
          </div>
        </div>
      </div>
    </div>
  );
}
