import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';

/**
 * FileReaderService - Trừu tượng hoá thao tác hệ thống tệp (FS)
 *
 * Mục tiêu:
 * - Dễ mock trong unit test (Dependency Inversion Principle)
 * - Đảm nhiệm một việc duy nhất: đọc/kiểm tra sự tồn tại file
 * - Có thể thay thế bởi nguồn lưu trữ khác (cloud storage) nếu cần
 *
 * Ví dụ:
 * constructor(private readonly fileReader: FileReaderService) {}
 * const content = await this.fileReader.readFile('./keys/public-key.pem');
 */
@Injectable()
export class FileReaderService {
  /**
   * Đọc nội dung file dưới dạng chuỗi UTF-8
   *
   * @param path Đường dẫn tuyệt đối hoặc tương đối tới file
   * @returns Nội dung file (string)
   * @throws Error nếu không thể đọc file
   */
  async readFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file at ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Kiểm tra file có tồn tại hay không
   *
   * @param path Đường dẫn cần kiểm tra
   * @returns true nếu file tồn tại, ngược lại false
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
