import { Module } from '@nestjs/common';
import { ReportModule } from '@report-app/report/report.module';
import { PrismaService } from '@report-app/prisma/prisma.service';

@Module({
  imports: [ReportModule],
  controllers: [],
  providers: [PrismaService],
})
export class ReportAppModule {}
