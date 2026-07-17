import { Module } from '@nestjs/common';
import { DeliveryOrderController } from './delivery-order.controller';
import { DeliveryOrderRepository } from './delivery-order.repository';
import { DeliveryOrderService } from './delivery-order.service';

@Module({
  controllers: [DeliveryOrderController],
  providers: [DeliveryOrderRepository, DeliveryOrderService],
  exports: [DeliveryOrderService],
})
export class DeliveryOrderModule {}
