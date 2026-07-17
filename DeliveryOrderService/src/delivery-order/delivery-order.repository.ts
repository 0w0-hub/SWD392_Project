import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { OrderStatus } from './enums/order-status.enum';
import { DeliveryOrder } from './schemas/delivery-order.schema';
import { Item } from './schemas/item.schema';

type DeliveryOrderRow = {
  orderId: number;
  orderStatus: OrderStatus;
  accountId: number;
  amountDue: number;
  authorizationId: number | null;
  supplierId: number;
  creationDate: string;
  plannedShipDate: string | null;
  actualShipDate: string | null;
  paymentDate: string | null;
};

type ItemRow = {
  itemId: number;
  unitCost: number;
  quantity: number;
};

@Injectable()
export class DeliveryOrderRepository implements OnModuleDestroy {
  private readonly db: Database.Database;

  constructor() {
    const dataDir = join(__dirname, '..', '..', 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    const dbFile =
      process.env.DELIVERY_ORDER_DB ?? join(dataDir, 'delivery-order.db');
    this.db = new Database(dbFile);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createSchema();
  }

  onModuleDestroy() {
    this.db.close();
  }

  insert(order: DeliveryOrder): void {
    const insertOrder = this.db.prepare(`
      INSERT INTO delivery_orders (
        orderId,
        orderStatus,
        accountId,
        amountDue,
        authorizationId,
        supplierId,
        creationDate,
        plannedShipDate,
        actualShipDate,
        paymentDate
      )
      VALUES (
        @orderId,
        @orderStatus,
        @accountId,
        @amountDue,
        @authorizationId,
        @supplierId,
        @creationDate,
        @plannedShipDate,
        @actualShipDate,
        @paymentDate
      )
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO delivery_order_items (orderId, itemId, unitCost, quantity)
      VALUES (@orderId, @itemId, @unitCost, @quantity)
    `);

    const transaction = this.db.transaction((storedOrder: DeliveryOrder) => {
      insertOrder.run(this.toOrderParams(storedOrder));
      for (const item of storedOrder.items ?? []) {
        insertItem.run({ orderId: storedOrder.orderId, ...item });
      }
    });

    transaction(order);
  }

  findNextForSupplier(supplierId: number): DeliveryOrder | null {
    const row = this.db
      .prepare(
        `
        SELECT *
          FROM delivery_orders
         WHERE supplierId = ?
           AND orderStatus = ?
         ORDER BY datetime(creationDate), orderId
         LIMIT 1
      `,
      )
      .get(supplierId, OrderStatus.NotYetShipped) as
      DeliveryOrderRow | undefined;

    return row ? this.toDeliveryOrder(row) : null;
  }

  findByOrderId(orderId: number): DeliveryOrder | null {
    const row = this.db
      .prepare('SELECT * FROM delivery_orders WHERE orderId = ?')
      .get(orderId) as DeliveryOrderRow | undefined;

    return row ? this.toDeliveryOrder(row) : null;
  }

  getNextOrderId(): number {
    const row = this.db
      .prepare('SELECT MAX(orderId) AS maxOrderId FROM delivery_orders')
      .get() as { maxOrderId: number | null };

    return row.maxOrderId == null ? 1 : row.maxOrderId + 1;
  }

  update(orderId: number, patch: Partial<DeliveryOrder>): DeliveryOrder | null {
    const allowedColumns = [
      'orderStatus',
      'accountId',
      'amountDue',
      'authorizationId',
      'supplierId',
      'creationDate',
      'plannedShipDate',
      'actualShipDate',
      'paymentDate',
    ] as const;

    const entries = allowedColumns
      .filter((column) => patch[column] !== undefined)
      .map((column) => [column, this.toDbValue(patch[column])] as const);

    const transaction = this.db.transaction(() => {
      if (entries.length > 0) {
        const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
        this.db
          .prepare(`UPDATE delivery_orders SET ${setClause} WHERE orderId = ?`)
          .run(...entries.map(([, value]) => value), orderId);
      }

      if (patch.items !== undefined) {
        this.replaceItems(orderId, patch.items);
      }
    });

    transaction();
    return this.findByOrderId(orderId);
  }

  replaceItems(orderId: number, items: Item[]): void {
    const deleteItems = this.db.prepare(
      'DELETE FROM delivery_order_items WHERE orderId = ?',
    );
    const insertItem = this.db.prepare(`
      INSERT INTO delivery_order_items (orderId, itemId, unitCost, quantity)
      VALUES (@orderId, @itemId, @unitCost, @quantity)
    `);

    deleteItems.run(orderId);
    for (const item of items) {
      insertItem.run({ orderId, ...item });
    }
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_orders (
        orderId        INTEGER PRIMARY KEY,
        orderStatus    TEXT    NOT NULL,
        accountId      INTEGER NOT NULL,
        amountDue      REAL    NOT NULL,
        authorizationId INTEGER,
        supplierId     INTEGER NOT NULL,
        creationDate   TEXT    NOT NULL,
        plannedShipDate TEXT,
        actualShipDate TEXT,
        paymentDate    TEXT,
        CHECK (orderStatus IN ('NotYetShipped', 'PreparedForShipment', 'Shipped'))
      );

      CREATE INDEX IF NOT EXISTS idx_delivery_orders_supplier_status_created
        ON delivery_orders (supplierId, orderStatus, creationDate);

      CREATE TABLE IF NOT EXISTS delivery_order_items (
        orderId  INTEGER NOT NULL,
        itemId   INTEGER NOT NULL,
        unitCost REAL    NOT NULL,
        quantity INTEGER NOT NULL,
        PRIMARY KEY (orderId, itemId),
        FOREIGN KEY (orderId)
          REFERENCES delivery_orders(orderId)
          ON DELETE CASCADE,
        CHECK (quantity > 0)
      );
    `);
  }

  private toDeliveryOrder(row: DeliveryOrderRow): DeliveryOrder {
    return {
      orderId: row.orderId,
      orderStatus: row.orderStatus,
      accountId: row.accountId,
      amountDue: row.amountDue,
      authorizationId: row.authorizationId ?? undefined,
      supplierId: row.supplierId,
      creationDate: new Date(row.creationDate),
      plannedShipDate: this.toDate(row.plannedShipDate),
      actualShipDate: this.toDate(row.actualShipDate),
      paymentDate: this.toDate(row.paymentDate),
      items: this.findItems(row.orderId),
    };
  }

  private findItems(orderId: number): Item[] {
    return this.db
      .prepare(
        `
        SELECT itemId, unitCost, quantity
          FROM delivery_order_items
         WHERE orderId = ?
         ORDER BY itemId
      `,
      )
      .all(orderId) as ItemRow[];
  }

  private toOrderParams(order: DeliveryOrder) {
    return {
      orderId: order.orderId,
      orderStatus: order.orderStatus,
      accountId: order.accountId,
      amountDue: order.amountDue,
      authorizationId: order.authorizationId ?? null,
      supplierId: order.supplierId,
      creationDate: this.toDbValue(order.creationDate),
      plannedShipDate: this.toDbValue(order.plannedShipDate),
      actualShipDate: this.toDbValue(order.actualShipDate),
      paymentDate: this.toDbValue(order.paymentDate),
    };
  }

  private toDbValue(value: unknown): string | number | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value as string | number;
  }

  private toDate(value: string | null): Date | undefined {
    return value ? new Date(value) : undefined;
  }
}
