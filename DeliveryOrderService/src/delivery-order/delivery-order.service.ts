import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from './enums/order-status.enum';
import { IDeliveryOrderService } from './interfaces/idelivery-order.service';
import {
  DeliveryOrder,
  DeliveryOrderDocument,
} from './schemas/delivery-order.schema';
import { Invoice } from './schemas/invoice.schema';

@Injectable()
export class DeliveryOrderService implements IDeliveryOrderService {
  constructor(
    @InjectModel(DeliveryOrder.name)
    private deliveryOrderModel: Model<DeliveryOrderDocument>,
  ) {}

  async store(order: DeliveryOrder): Promise<number> {
    const orderId = order.orderId ?? (await this.getNextOrderId());
    const createdOrder = new this.deliveryOrderModel({
      ...order,
      orderId,
      orderStatus: order.orderStatus ?? OrderStatus.NotYetShipped,
      creationDate: order.creationDate ?? new Date(),
    });

    await createdOrder.save();
    return orderId;
  }

  async select(supplierId: number): Promise<DeliveryOrder> {
    const order = await this.deliveryOrderModel
      .findOne({
        supplierId,
        orderStatus: OrderStatus.NotYetShipped,
      })
      .sort({ creationDate: 1 })
      .exec();

    return this.requireOrder(
      order,
      `No delivery order found for supplier ${supplierId}`,
    );
  }

  async update(
    orderId: number,
    order: Partial<DeliveryOrder>,
  ): Promise<OrderStatus> {
    const updatedOrder = await this.deliveryOrderModel
      .findOneAndUpdate({ orderId }, order, { new: true, runValidators: true })
      .exec();

    return this.requireOrder(updatedOrder, `Order ${orderId} not found`)
      .orderStatus;
  }

  async orderShipped(orderId: number): Promise<OrderStatus> {
    const updatedOrder = await this.deliveryOrderModel
      .findOneAndUpdate(
        { orderId },
        {
          orderStatus: OrderStatus.Shipped,
          actualShipDate: new Date(),
        },
        { new: true },
      )
      .exec();

    return this.requireOrder(updatedOrder, `Order ${orderId} not found`)
      .orderStatus;
  }

  async confirmPayment(orderId: number, amount: number): Promise<OrderStatus> {
    const order = await this.read(orderId);

    if (order.amountDue !== amount) {
      throw new BadRequestException(
        `Payment amount ${amount} does not match order amount ${order.amountDue}`,
      );
    }

    const updatedOrder = await this.deliveryOrderModel
      .findOneAndUpdate(
        { orderId },
        {
          paymentDate: new Date(),
          orderStatus: OrderStatus.PreparedForShipment,
        },
        { new: true },
      )
      .exec();

    return this.requireOrder(updatedOrder, `Order ${orderId} not found`)
      .orderStatus;
  }

  async read(orderId: number): Promise<DeliveryOrder> {
    const order = await this.deliveryOrderModel.findOne({ orderId }).exec();
    return this.requireOrder(order, `Order ${orderId} not found`);
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

  async prepareToCommitOrder(orderId: number): Promise<DeliveryOrder> {
    const order = await this.deliveryOrderModel
      .findOneAndUpdate(
        { orderId },
        { orderStatus: OrderStatus.PreparedForShipment },
        { new: true },
      )
      .exec();

    return this.requireOrder(order, `Order ${orderId} not found`);
  }

  async commit(orderId: number): Promise<void> {
    await this.orderShipped(orderId);
  }

  async abort(orderId: number): Promise<void> {
    const order = await this.deliveryOrderModel
      .findOneAndUpdate(
        { orderId },
        {
          orderStatus: OrderStatus.NotYetShipped,
          paymentDate: null,
          actualShipDate: null,
        },
        { new: true },
      )
      .exec();

    this.requireOrder(order, `Order ${orderId} not found`);
  }

  private async getNextOrderId(): Promise<number> {
    const latestOrder = await this.deliveryOrderModel
      .findOne()
      .sort({ orderId: -1 })
      .select('orderId')
      .exec();

    return latestOrder ? latestOrder.orderId + 1 : 1;
  }

  private requireOrder(
    order: DeliveryOrderDocument | DeliveryOrder | null,
    message: string,
  ): DeliveryOrder {
    if (!order) {
      throw new NotFoundException(message);
    }

    return order;
  }
}
