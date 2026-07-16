import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryOrderController } from './delivery-order.controller';
import { DeliveryOrderService } from './delivery-order.service';
import {
  DeliveryOrder,
  DeliveryOrderSchema,
} from './schemas/delivery-order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryOrder.name, schema: DeliveryOrderSchema },
    ]),
  ],
  controllers: [DeliveryOrderController],
  providers: [DeliveryOrderService],
  exports: [DeliveryOrderService],
})
export class DeliveryOrderModule {}
