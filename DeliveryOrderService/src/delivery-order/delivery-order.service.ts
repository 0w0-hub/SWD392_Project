import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryOrderRepository } from './delivery-order.repository';
import { OrderStatus } from './enums/order-status.enum';
import { IDeliveryOrderService } from './interfaces/idelivery-order.service';
import { DeliveryOrder } from './schemas/delivery-order.schema';
import { Invoice } from './schemas/invoice.schema';

@Injectable()
export class DeliveryOrderService implements IDeliveryOrderService {
  constructor(
    private readonly deliveryOrderRepository: DeliveryOrderRepository,
  ) {}

  store(order: DeliveryOrder): Promise<number> {
    const orderId =
      order.orderId ?? this.deliveryOrderRepository.getNextOrderId();
    const createdOrder: DeliveryOrder = {
      ...order,
      orderId,
      orderStatus: order.orderStatus ?? OrderStatus.NotYetShipped,
      creationDate: order.creationDate ?? new Date(),
      items: order.items ?? [],
    };

    this.deliveryOrderRepository.insert(createdOrder);
    return Promise.resolve(orderId);
  }

  select(supplierId: number): Promise<DeliveryOrder> {
    const order = this.deliveryOrderRepository.findNextForSupplier(supplierId);

    return Promise.resolve(
      this.requireOrder(
        order,
        `No delivery order found for supplier ${supplierId}`,
      ),
    );
  }

  update(orderId: number, order: Partial<DeliveryOrder>): Promise<OrderStatus> {
    const updatedOrder = this.deliveryOrderRepository.update(orderId, order);

    return Promise.resolve(
      this.requireOrder(updatedOrder, `Order ${orderId} not found`).orderStatus,
    );
  }

  orderShipped(orderId: number): Promise<OrderStatus> {
    const updatedOrder = this.deliveryOrderRepository.update(orderId, {
      orderStatus: OrderStatus.Shipped,
      actualShipDate: new Date(),
    });

    return Promise.resolve(
      this.requireOrder(updatedOrder, `Order ${orderId} not found`).orderStatus,
    );
  }

  async confirmPayment(orderId: number, amount: number): Promise<OrderStatus> {
    const order = await this.read(orderId);

    if (order.amountDue !== amount) {
      throw new BadRequestException(
        `Payment amount ${amount} does not match order amount ${order.amountDue}`,
      );
    }

    const updatedOrder = this.deliveryOrderRepository.update(orderId, {
      paymentDate: new Date(),
      orderStatus: OrderStatus.PreparedForShipment,
    });

    return this.requireOrder(updatedOrder, `Order ${orderId} not found`)
      .orderStatus;
  }

  read(orderId: number): Promise<DeliveryOrder> {
    const order = this.deliveryOrderRepository.findByOrderId(orderId);
    return Promise.resolve(
      this.requireOrder(order, `Order ${orderId} not found`),
    );
  }

  async requestInvoice(orderId: number): Promise<Invoice> {
    const order = await this.read(orderId);

    return {
      orderId: order.orderId,
      accountId: order.accountId,
      amountDue: order.amountDue,
      actualShipDate: order.actualShipDate,
      authorizationId: order.authorizationId,
    };
  }

  prepareToCommitOrder(orderId: number): Promise<DeliveryOrder> {
    const order = this.deliveryOrderRepository.update(orderId, {
      orderStatus: OrderStatus.PreparedForShipment,
    });

    return Promise.resolve(
      this.requireOrder(order, `Order ${orderId} not found`),
    );
  }

  async commit(orderId: number): Promise<void> {
    await this.orderShipped(orderId);
  }

  abort(orderId: number): Promise<void> {
    const order = this.deliveryOrderRepository.update(orderId, {
      orderStatus: OrderStatus.NotYetShipped,
      paymentDate: null,
      actualShipDate: null,
    });

    this.requireOrder(order, `Order ${orderId} not found`);
    return Promise.resolve();
  }

  private requireOrder(
    order: DeliveryOrder | null,
    message: string,
  ): DeliveryOrder {
    if (!order) {
      throw new NotFoundException(message);
    }

    return order;
  }
}
