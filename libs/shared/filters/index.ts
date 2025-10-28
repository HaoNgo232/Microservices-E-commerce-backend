/**
 * Gói tiện ích xử lý lỗi dùng chung
 * - Parser: chuẩn hoá lỗi về cấu trúc thống nhất
 * - Detector: nhận diện loại lỗi qua pattern
 * - Builder: dựng response cho HTTP/RPC
 * - Global RPC Filter: chuyển đổi ngoại lệ thành phản hồi nhất quán
 */
export * from './error-parser';
export * from './error-detector';
export * from './error-response-builder';
export * from './rpc-exception.filter';
