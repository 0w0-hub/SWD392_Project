import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { DeliveryOrderService } from './delivery-order.service';
import { DeliveryOrder } from './schemas/delivery-order.schema';

@Controller('delivery-orders')
export class DeliveryOrderController {
  constructor(private readonly deliveryOrderService: DeliveryOrderService) {}

  @Post()
  async store(@Body() order: DeliveryOrder) {
    const orderId = await this.deliveryOrderService.store(order);
    return { orderId };
  }

  @Get('supplier/:supplierId/next')
  async select(@Param('supplierId', ParseIntPipe) supplierId: number) {
    return this.deliveryOrderService.select(supplierId);
  }

  @Patch(':orderId')
  async update(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() order: Partial<DeliveryOrder>,
  ) {
    const orderStatus = await this.deliveryOrderService.update(orderId, order);
    return { orderStatus };
  }

  @Post(':orderId/shipped')
  async orderShipped(@Param('orderId', ParseIntPipe) orderId: number) {
    const orderStatus = await this.deliveryOrderService.orderShipped(orderId);
    return { orderStatus };
  }

  @Post(':orderId/payment-confirmation')
  async confirmPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body('amount', ParseIntPipe) amount: number,
  ) {
    const orderStatus = await this.deliveryOrderService.confirmPayment(
      orderId,
      amount,
    );
    return { orderStatus };
  }

  @Get(':orderId')
  async read(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.deliveryOrderService.read(orderId);
  }

  @Get(':orderId/invoice')
  async requestInvoice(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.deliveryOrderService.requestInvoice(orderId);
  }

  @Post(':orderId/prepare')
  async prepareToCommitOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.deliveryOrderService.prepareToCommitOrder(orderId);
  }

  @Post(':orderId/commit')
  async commit(@Param('orderId', ParseIntPipe) orderId: number) {
    await this.deliveryOrderService.commit(orderId);
    return { committed: true };
  }

  @Post(':orderId/abort')
  async abort(@Param('orderId', ParseIntPipe) orderId: number) {
    await this.deliveryOrderService.abort(orderId);
    return { aborted: true };
  }
}
