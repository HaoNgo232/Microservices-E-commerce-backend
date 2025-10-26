/**
 * Cart Response Types
 * Định nghĩa các response types cho cart endpoints
 * KHÔNG sử dụng Prisma generated types để tránh coupling
 */

/**
 * Cart item cơ bản
 */
export type CartItemResponse = {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Cart item với thông tin sản phẩm đầy đủ
 */
export type CartItemWithProduct = CartItemResponse & {
  product: {
    id: string;
    name: string;
    priceInt: number;
    imageUrls: string[];
  } | null;
};

/**
 * Cart response cơ bản
 */
export type CartResponse = {
  id: string;
  sessionId: string;
  userId: string | null;
  items: CartItemResponse[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Cart với items và product data đầy đủ
 */
export type CartWithProductsResponse = {
  cart: CartResponse;
  items: CartItemWithProduct[];
  totalInt: number;
};

/**
 * Kết quả thêm/cập nhật item
 *
 * Note: cartItem có thể null nếu updateQuantity set quantity=0 (item bị xóa)
 */
export type CartItemOperationResponse = {
  cartItem: CartItemResponse | null;
};

/**
 * Kết quả xóa item hoặc clear cart
 */
export type CartOperationSuccessResponse = {
  success: boolean;
};

/**
 * Kết quả merge guest cart
 */
export type CartMergeResponse = {
  cart: {
    id: string;
    itemsCount: number;
  };
};

/**
 * Kết quả transfer cart từ session sang user
 */
export type TransferCartResponse = {
  success: boolean;
  cartId: string;
  itemsTransferred: number;
};

/**
 * Product data từ Product Service (internal type)
 *
 * Note: Stock validation is now supported
 * - stock > 0: Sản phẩm còn hàng
 * - stock = 0: Hết hàng (không thể thêm, nhưng có thể xem trong cart)
 * - stock < 0: Lỗi state (không nên xảy ra)
 */
export type ProductData = {
  id: string;
  name: string;
  priceInt: number;
  imageUrls: string[];
  stock?: number; // Optional stock count for validation
};
