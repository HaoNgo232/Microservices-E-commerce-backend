import { Test, TestingModule } from '@nestjs/testing';
import { FileReaderService } from './file-reader.service';
import * as fs from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('FileReaderService', () => {
  let service: FileReaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileReaderService],
    }).compile();

    service = module.get<FileReaderService>(FileReaderService);
    jest.clearAllMocks();
  });

  describe('readFile', () => {
    it('should read file content successfully', async () => {
      const filePath = '/path/to/file.txt';
      const fileContent = 'File content';

      (fs.readFile as jest.Mock).mockResolvedValue(fileContent);

      const result = await service.readFile(filePath);

      expect(result).toBe(fileContent);
      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
    });

    it('should throw error when file read fails', async () => {
      const filePath = '/path/to/nonexistent.txt';
      const error = new Error('ENOENT: no such file or directory');

      (fs.readFile as jest.Mock).mockRejectedValue(error);

      await expect(service.readFile(filePath)).rejects.toThrow('Failed to read file');
      await expect(service.readFile(filePath)).rejects.toThrow(filePath);
      await expect(service.readFile(filePath)).rejects.toThrow('ENOENT');
    });

    it('should handle non-Error rejection', async () => {
      const filePath = '/path/to/file.txt';

      (fs.readFile as jest.Mock).mockRejectedValue('String error');

      await expect(service.readFile(filePath)).rejects.toThrow('Failed to read file');
      await expect(service.readFile(filePath)).rejects.toThrow('Unknown error');
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      const filePath = '/path/to/existing.txt';

      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await service.fileExists(filePath);

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });

    it('should return false when file does not exist', async () => {
      const filePath = '/path/to/nonexistent.txt';

      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const result = await service.fileExists(filePath);

      expect(result).toBe(false);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });

    it('should return false for any access error', async () => {
      const filePath = '/path/to/file.txt';

      (fs.access as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      const result = await service.fileExists(filePath);

      expect(result).toBe(false);
    });
  });
});
