/**
 * Bộ trợ giúp (Helpers) cho kiểm thử RPC qua NATS
 * Cung cấp các hàm assert lỗi do microservice trả về qua Observable error stream.
 */

/**
 * Khẳng định lời hứa (Promise) bị lỗi RPC
 *
 * NATS gửi lỗi qua Observable error stream, không phải throw như exception thông thường.
 *
 * @example
 * await expectRpcError(
 *   firstValueFrom(client.send(EVENTS.USER.GET, 'invalid-id')),
 *   'không tồn tại'
 * );
 */
export const expectRpcError = async (promise: Promise<unknown>, expectedMessage?: string): Promise<void> => {
  try {
    await promise;
    throw new Error('Expected RpcException but got success');
  } catch (error: unknown) {
    expect(error).toBeDefined();

    if (expectedMessage) {
      const err = error as Record<string, unknown>;
      const msg =
        (typeof err.message === 'string' ? err.message : '') || (typeof err.msg === 'string' ? err.msg : '') || '';
      expect(msg).toContain(expectedMessage);
    }
  }
};

/**
 * Khẳng định lỗi RPC kèm mã trạng thái
 *
 * @example
 * await expectRpcErrorWithStatus(
 *   firstValueFrom(client.send(EVENTS.USER.GET, 'invalid-id')),
 *   404,
 *   'không tồn tại'
 * );
 */
export const expectRpcErrorWithStatus = async (
  promise: Promise<unknown>,
  expectedStatusCode: number,
  expectedMessage?: string,
): Promise<void> => {
  try {
    await promise;
    throw new Error('Expected RpcException but got success');
  } catch (error: unknown) {
    expect(error).toBeDefined();

    const err = error as Record<string, unknown>;

    // Kiểm tra status code
    if (typeof err.statusCode === 'number') {
      expect(err.statusCode).toBe(expectedStatusCode);
    }

    // Kiểm tra thông điệp (nếu cung cấp)
    if (expectedMessage) {
      const msg =
        (typeof err.message === 'string' ? err.message : '') || (typeof err.msg === 'string' ? err.msg : '') || '';
      expect(msg).toContain(expectedMessage);
    }
  }
};

/**
 * Tạo email test duy nhất theo thời gian
 *
 * @example
 * const email = createTestEmail('user'); // user-1234567890@test.com
 */
export const createTestEmail = (prefix: string = 'test'): string => {
  return `${prefix}-${Date.now()}@test.com`;
};

/**
 * Tạo mã định danh test duy nhất theo thời gian
 *
 * @example
 * const id = createTestId('user'); // user-1234567890
 */
export const createTestId = (prefix: string = 'test'): string => {
  return `${prefix}-${Date.now()}`;
};
