import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryOrderModule } from './delivery-order/delivery-order.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/delivery-order',
    ),
    DeliveryOrderModule,
  ],
})
export class AppModule {}
