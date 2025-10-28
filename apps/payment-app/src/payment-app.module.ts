import { Module } from '@nestjs/common';
import { PaymentsModule } from '@payment-app/payments/payments.module';
import { PrismaService } from '@payment-app/prisma/prisma.service';

@Module({
  imports: [PaymentsModule],
  controllers: [],
  providers: [PrismaService],
})
export class PaymentAppModule {}
