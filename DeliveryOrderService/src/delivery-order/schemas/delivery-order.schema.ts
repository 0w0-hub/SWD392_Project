import { OrderStatus } from '../enums/order-status.enum';
import { Item } from './item.schema';

export class DeliveryOrder {
  orderId: number;
  orderStatus: OrderStatus;
  accountId: number;
  amountDue: number;
  authorizationId?: number;
  supplierId: number;
  creationDate: Date;
  plannedShipDate?: Date | null;
  actualShipDate?: Date | null;
  paymentDate?: Date | null;
  items: Item[];
}
