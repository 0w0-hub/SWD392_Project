import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { OrderStatus } from '../enums/order-status.enum';
import { Item, ItemSchema } from './item.schema';

export type DeliveryOrderDocument = DeliveryOrder & Document;

@Schema()
export class DeliveryOrder {
  @Prop({ required: true, unique: true })
  orderId: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.NotYetShipped,
    required: true,
  })
  orderStatus: OrderStatus;

  @Prop({ required: true })
  accountId: number;

  @Prop({ required: true })
  amountDue: number;

  @Prop()
  authorizationId?: number;

  @Prop({ required: true })
  supplierId: number;

  @Prop({ type: Date, default: Date.now })
  creationDate: Date;

  @Prop()
  plannedShipDate?: Date;

  @Prop()
  actualShipDate?: Date;

  @Prop()
  paymentDate?: Date;

  @Prop({ type: [ItemSchema], required: true, default: [] })
  items: Item[];
}

export const DeliveryOrderSchema = SchemaFactory.createForClass(DeliveryOrder);

DeliveryOrderSchema.index({ supplierId: 1, orderStatus: 1, creationDate: 1 });
