import { useState, useEffect } from "react";
import type { AmazonOrder } from "@/types";
import { useAppState } from "./hooks/useAppState";
import { StepIndicator } from "./components/StepIndicator";
import { OrderCard } from "./components/OrderCard";
import { ClaimCard } from "./components/ClaimCard";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function App() {
  const { state, loading, sendMessage } = useAppState();
  const [invoiceUrls, setInvoiceUrls] = useState<Record<string, string>>({});

  // Load invoice data URLs for claims that need them
  useEffect(() => {
    const orderIds = state.claims
      .filter((c) => c.status !== "submitted" && c.status !== "skipped")
      .map((c) => c.sourceOrderId);

    if (orderIds.length === 0) return;

    void (async () => {
      const urls: Record<string, string> = {};
      for (const orderId of orderIds) {
        const key = `invoice:${orderId}`;
        const result = await chrome.storage.local.get(key);
        if (result[key]) urls[orderId] = result[key] as string;
      }
      setInvoiceUrls(urls);
    })();
  }, [state.claims]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  const { currentStep } = state;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-sm">FSA Claim Automation</h1>
          <div className="text-xs text-gray-500">
            Benefit Year: {state.benefitYear.label}
          </div>
        </div>
        {currentStep !== "idle" && (
          <button
            onClick={() => {
              if (confirm("Reset all data and start over?")) {
                void sendMessage({ type: "RESET_WORKFLOW" });
              }
            }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Step Indicator */}
      {currentStep !== "idle" && (
        <StepIndicator currentStep={currentStep} />
      )}

      {/* Error Banner */}
      {state.lastError && (
        <div className="mx-4 mt-3 text-xs text-red-600 bg-red-50 rounded p-2 border border-red-200 flex items-start justify-between gap-2">
          <span>⚠ {state.lastError}</span>
          <button
            onClick={() => void sendMessage({ type: "RESET_WORKFLOW" })}
            className="flex-shrink-0 underline hover:no-underline"
          >
            Reset
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        {/* IDLE */}
        {currentStep === "idle" && (
          <IdleStep state={state} sendMessage={sendMessage} />
        )}

        {/* SCANNING ORDERS */}
        {(currentStep === "navigate_amazon" || currentStep === "scanning_amazon") && (
          <div className="p-4 space-y-3">
            <div className="text-sm font-medium">Scanning Amazon orders...</div>
            <div className="text-xs text-gray-500">
              Found {state.orders.length} order
              {state.orders.length !== 1 ? "s" : ""} in benefit year so far
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full animate-pulse"
                  style={{ width: "60%" }}
                />
              </div>
              <span className="text-xs text-gray-400">Scanning...</span>
            </div>
            <div className="text-xs text-gray-400">
              Please keep the Amazon tab open and do not navigate away.
            </div>
          </div>
        )}

        {/* SCANNING INVOICES */}
        {currentStep === "scanning_invoices" && (
          <div className="p-4 space-y-3">
            <div className="text-sm font-medium">Scanning invoices for FSA label...</div>
            <div className="text-xs text-gray-500">
              {state.invoiceScanProgress
                ? `${state.invoiceScanProgress.scanned} / ${state.invoiceScanProgress.total} invoices checked`
                : "Starting invoice scan..."}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{
                    width: state.invoiceScanProgress && state.invoiceScanProgress.total > 0
                      ? `${Math.round((state.invoiceScanProgress.scanned / state.invoiceScanProgress.total) * 100)}%`
                      : "5%",
                  }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {state.invoiceScanProgress && state.invoiceScanProgress.total > 0
                  ? `${Math.round((state.invoiceScanProgress.scanned / state.invoiceScanProgress.total) * 100)}%`
                  : "..."}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              Opening each invoice to detect the "FSA or HSA eligible" label. Do not close the Amazon tab.
            </div>
          </div>
        )}

        {/* REVIEW ORDERS */}
        {currentStep === "reviewing_orders" && (
          <ReviewOrdersStep
            state={state}
            onProceed={(selectedIds, folderName) => {
              void sendMessage({
                type: "SELECT_ORDERS",
                orderIds: selectedIds,
                exportFolderName: folderName,
              });
            }}
            onRescan={() => void sendMessage({ type: "SCAN_ORDERS_REQUEST" })}
          />
        )}

        {/* NAVIGATE NAVIA */}
        {currentStep === "navigate_navia" && (
          <div className="p-4 space-y-3">
            <div className="text-sm font-medium">Ready to submit claims</div>
            <div className="text-xs text-gray-500">
              {state.claims.length} claim
              {state.claims.length !== 1 ? "s" : ""} ready to submit to Navia
              Benefits.
            </div>
            <div className="text-xs text-gray-500">
              Total:{" "}
              {formatCents(
                state.claims.reduce((s, c) => s + c.totalAmount, 0)
              )}
            </div>
            <button
              onClick={() => void sendMessage({ type: "NAVIGATE_NAVIA" })}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Open Navia Benefits
            </button>
            <div className="text-xs text-gray-400">
              Log in to Navia, then navigate to the Submit Claim page.
            </div>
            <button
              onClick={() => void sendMessage({ type: "BEGIN_SUBMITTING" })}
              className="w-full py-2 px-4 border border-blue-400 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              I'm on the Submit Claim page →
            </button>
          </div>
        )}

        {/* SUBMITTING CLAIMS */}
        {currentStep === "submitting_claims" && (
          <div>
            {state.claims
              .filter(
                (c) => c.status !== "submitted" && c.status !== "skipped"
              )
              .slice(0, 1)
              .map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  invoiceDataUrl={invoiceUrls[claim.sourceOrderId]}
                  onFill={(id) =>
                    void sendMessage({ type: "FILL_CLAIM_REQUEST", claimId: id })
                  }
                  onSkip={(id) =>
                    void sendMessage({ type: "SKIP_CLAIM", claimId: id })
                  }
                />
              ))}
            <div className="px-4 pb-3 text-xs text-gray-400">
              {state.claims.filter((c) => c.status === "submitted").length} of{" "}
              {state.claims.length} submitted
            </div>
          </div>
        )}

        {/* COMPLETE */}
        {currentStep === "complete" && (
          <div className="p-4 space-y-3 text-center">
            <div className="text-2xl">✓</div>
            <div className="text-sm font-semibold">All Done!</div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>
                Submitted:{" "}
                {state.claims.filter((c) => c.status === "submitted").length}{" "}
                claims (
                {formatCents(
                  state.claims
                    .filter((c) => c.status === "submitted")
                    .reduce((s, c) => s + c.totalAmount, 0)
                )}
                )
              </div>
              {state.claims.filter((c) => c.status === "skipped").length >
                0 && (
                <div>
                  Skipped:{" "}
                  {state.claims.filter((c) => c.status === "skipped").length}{" "}
                  claims
                </div>
              )}
            </div>
            <button
              onClick={() => void sendMessage({ type: "RESET_WORKFLOW" })}
              className="w-full py-2 px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Start New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Idle Step ────────────────────────────────────────────────────────────────

interface IdleStepProps {
  state: ReturnType<typeof useAppState>["state"];
  sendMessage: ReturnType<typeof useAppState>["sendMessage"];
}

function IdleStep({ state, sendMessage }: IdleStepProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  // Offer the current year and the two prior years
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const startScan = () => {
    void sendMessage({ type: "START_WORKFLOW", benefitYear: selectedYear }).then(() =>
      sendMessage({ type: "SCAN_ORDERS_REQUEST" })
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-gray-600">
        Scan your Amazon order history for FSA-eligible purchases, then
        auto-submit claims to Navia Benefits.
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Benefit Year</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y} (Jan 1 – Dec 31, {y})
            </option>
          ))}
        </select>
      </div>

      {state.lastScanAt && (() => {
        const d = new Date(state.lastScanAt);
        return !isNaN(d.getTime()) ? (
          <div className="text-xs text-gray-400">Last scan: {d.toLocaleDateString()}</div>
        ) : null;
      })()}

      <button
        onClick={startScan}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Scan {selectedYear} Orders
      </button>
    </div>
  );
}

// ─── Review Orders Step ───────────────────────────────────────────────────────

interface ReviewOrdersStepProps {
  state: ReturnType<typeof useAppState>["state"];
  onProceed: (selectedIds: string[], folderName: string) => void;
  onRescan: () => void;
}

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ReviewOrdersStep({ state, onProceed, onRescan }: ReviewOrdersStepProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    state.orders.map((o) => o.orderId)
  );
  const [folderName, setFolderName] = useState(state.exportFolderName ?? todayISODate());

  const toggleOrder = (orderId: string) => {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const selectedOrders = state.orders.filter((o: AmazonOrder) =>
    selectedIds.includes(o.orderId)
  );
  const totalEligible = selectedOrders.reduce(
    (sum: number, o: AmazonOrder) => sum + (o.fsaEligibleAmount ?? o.totalAmount),
    0
  );

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-gray-700">
            {state.orders.filter((o) => o.invoiceScanStatus === "confirmed").length} FSA-confirmed
            {" / "}{state.orders.length} order{state.orders.length !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-gray-500">
            Selected total: {formatCents(totalEligible)}
          </div>
        </div>
        <button
          onClick={onRescan}
          className="text-xs text-blue-600 hover:underline"
        >
          Rescan
        </button>
      </div>

      {state.orders.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-400">
          No FSA-eligible orders found for {state.benefitYear.label}.
          <br />
          <span className="text-xs">
            Items must match FSA eligibility criteria.
          </span>
        </div>
      ) : (
        <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
          {state.orders.map((order: AmazonOrder) => (
            <OrderCard
              key={order.orderId}
              order={order}
              selected={selectedIds.includes(order.orderId)}
              onToggle={toggleOrder}
            />
          ))}
        </div>
      )}

      <div className="p-3 border-t border-gray-100 space-y-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            Export folder name
          </label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value.trim())}
            placeholder={todayISODate()}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="text-xs text-gray-400">
            Saved to Downloads/{folderName || todayISODate()}/
          </div>
        </div>
        <button
          onClick={() => onProceed(selectedIds, folderName || todayISODate())}
          disabled={selectedIds.length === 0}
          className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Proceed to Submit ({selectedIds.length})
        </button>
      </div>
    </div>
  );
}
