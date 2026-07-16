export class Invoice {
  orderId: number;
  accountId: number;
  amountDue: number;
  actualShipDate?: Date;
  authorizationId?: number;
}
