import { Module, Global } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { FileReaderService } from '../utils/file-reader.service';

/**
 * JWT Module (Global)
 *
 * Cung cấp JwtService dùng chung trên toàn bộ ứng dụng (được đánh dấu @Global()).
 * - Dùng FileReaderService để đọc key RSA từ ổ đĩa
 *
 * Cách dùng:
 * 1) Import JwtModule ở root module của app
 * 2) Inject JwtService ở bất kỳ service/controller nào cần
 *
 * Ví dụ:
 * @Module({ imports: [JwtModule] })
 * export class AppModule {}
 *
 * constructor(private readonly jwtService: JwtService) {}
 */
@Global()
@Module({
  providers: [JwtService, FileReaderService],
  exports: [JwtService],
})
export class JwtModule {}
