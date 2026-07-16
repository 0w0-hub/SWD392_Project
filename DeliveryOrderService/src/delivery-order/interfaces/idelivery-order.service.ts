import { OrderStatus } from '../enums/order-status.enum';
import { DeliveryOrder } from '../schemas/delivery-order.schema';
import { Invoice } from '../schemas/invoice.schema';

export interface IDeliveryOrderService {
  store(order: DeliveryOrder): Promise<number>;
  select(supplierId: number): Promise<DeliveryOrder>;
  update(orderId: number, order: Partial<DeliveryOrder>): Promise<OrderStatus>;
  orderShipped(orderId: number): Promise<OrderStatus>;
  confirmPayment(orderId: number, amount: number): Promise<OrderStatus>;
  read(orderId: number): Promise<DeliveryOrder>;
  requestInvoice(orderId: number): Promise<Invoice>;
  prepareToCommitOrder(orderId: number): Promise<DeliveryOrder>;
  commit(orderId: number): Promise<void>;
  abort(orderId: number): Promise<void>;
}
