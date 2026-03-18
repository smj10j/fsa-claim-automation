import type { AmazonOrder } from "@/types";

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

export function OrderCard({ order, selected, onToggle }: Props) {
  const eligibleTotal = order.eligibleItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

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
          <div className="min-w-0">
            <div className="text-xs text-gray-500">
              {formatDate(order.orderDate)} · #{order.orderId}
            </div>
            <div className="font-medium text-xs mt-0.5 truncate">
              {order.eligibleItems[0]?.title ?? "Unknown item"}
              {order.eligibleItems.length > 1 && (
                <span className="text-gray-400">
                  {" "}
                  +{order.eligibleItems.length - 1} more
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-semibold text-sm font-mono">
            {formatCents(eligibleTotal)}
          </div>
          <div
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
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
