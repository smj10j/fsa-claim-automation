/**
 * Amazon DOM selectors for order history and order detail pages.
 *
 * IMPORTANT: Amazon A/B tests their UI. When selectors break, update here.
 * Use multiple fallbacks where possible.
 *
 * Last verified: 2026-03-17
 * @see https://www.amazon.com/gp/your-account/order-history
 */

export const AMAZON_SELECTORS = {
  // Order history page
  orderHistory: {
    // Container for a single order
    orderContainer: ".order, .a-box-group.order",
    // Order ID text - try multiple selectors
    orderId: [
      ".yohtmlc-order-id span:last-child",
      "[data-order-id]",
      ".order-info .a-size-mini span",
    ],
    // Order date
    orderDate: [
      ".order-info .a-color-secondary",
      ".a-col-left .a-color-secondary",
      ".a-size-sm.a-color-secondary",
    ],
    // Order total
    orderTotal: [
      ".a-col-right .a-size-base-plus",
      ".order-info .a-size-mini:last-child",
    ],
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
