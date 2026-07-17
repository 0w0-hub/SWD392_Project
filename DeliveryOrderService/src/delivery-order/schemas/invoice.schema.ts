export class Invoice {
  orderId: number;
  accountId: number;
  amountDue: number;
  actualShipDate?: Date | null;
  authorizationId?: number;
}
