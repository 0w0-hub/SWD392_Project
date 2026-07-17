import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CatalogInfo } from './catalog-info.schema';
import { Supplier } from './supplier.schema';

@Entity({ name: 'items' })
@Check('CHK_item_id_positive', 'itemId > 0')
@Check('CHK_item_unit_cost_non_negative', 'unitCost >= 0')
@Check('CHK_item_supplier_id_positive', 'supplierId > 0')
export class ItemInfo {
  @PrimaryColumn({ type: 'integer' })
  itemId: number;

  @Column()
  itemDescription: string;

  @Column({ type: 'real' })
  unitCost: number;

  @Column({ type: 'integer' })
  supplierId: number;

  @Column({ type: 'text', nullable: true })
  itemDetails: string | null;

  @ManyToOne(() => Supplier, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId', referencedColumnName: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => CatalogInfo, (catalog) => catalog.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'catalogId', referencedColumnName: 'catalogId' })
  catalog: CatalogInfo;
}
