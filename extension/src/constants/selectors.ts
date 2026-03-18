/**
 * Amazon DOM selectors for order history and order detail pages.
 *
 * IMPORTANT: Amazon A/B tests their UI. When selectors break, update here.
 * Use multiple fallbacks where possible.
 *
 * Last verified: 2026-03-17 (confirmed against live Amazon order history)
 * @see https://www.amazon.com/gp/your-account/order-history
 */

export const AMAZON_SELECTORS = {
  // Order history page
  orderHistory: {
    // Container for a single order (confirmed: .a-box-group, not .order)
    orderContainer: ".a-box-group",
    // Order ID text
    orderId: [
      ".yohtmlc-order-id span:last-child",
      "[data-order-id]",
    ],
    // Labels used to find date/total via label-based lookup (see order-scanner.ts)
    // Date and total share the same class (.aok-break-word), distinguished by label
    metaLabel: ".a-color-secondary.a-text-caps",  // "Order placed", "Total", "Order #"
    metaValue: ".aok-break-word",                  // the value after each label
    // Individual items within an order
    orderItem: ".a-fixed-left-grid, .yohtmlc-item",
    // Item title
    itemTitle: [
      ".yohtmlc-product-title",
      ".a-link-normal .a-size-base-plus",
      ".a-link-normal",
    ],
    // Item price
    itemPrice: [".a-price .a-offscreen", ".a-color-price"],
    // "Order Details" link
    orderDetailsLink: [
      "a[href*='order-details']",
      "a[href*='/gp/css/summary/']",
      ".yohtmlc-order-details-link",
    ],
    // Pagination "Next" button
    paginationNext: ".a-pagination .a-last a, #orderListViewForm a[href*='startIndex']",
  },

  // Order detail / receipt page
  orderDetail: {
    // The main order summary box to screenshot
    receiptContainer: [
      "#orderDetails",
      ".a-box.shipment",
      ".order-summary",
      "#od-subtotals",
    ],
    // Item rows in the order
    lineItem: ".a-fixed-left-grid-col, .shipment-items .a-row",
    // Item title on detail page
    itemTitle: ".a-link-normal",
    // Order date
    orderDate: [".a-size-base .a-text-bold", ".a-size-medium"],
  },
} as const;
