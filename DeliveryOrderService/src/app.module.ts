import { Module } from '@nestjs/common';
import { BrokerModule } from './broker/broker.module';
import { DeliveryOrderModule } from './delivery-order/delivery-order.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DeliveryOrderModule, BrokerModule],
  controllers: [HealthController],
})
export class AppModule {}
