import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { CatalogType } from '../enums/catalog-type.enum';
import { ItemInfo } from './item-info.schema';
import { Supplier } from './supplier.schema';

@Entity({ name: 'catalogs' })
@Check('CHK_catalog_id_positive', 'catalogId > 0')
@Check('CHK_catalog_supplier_id_positive', 'supplierId > 0')
export class CatalogInfo {
  @PrimaryColumn({ type: 'integer' })
  catalogId: number;

  @Column()
  catalogDescription: string;

  @Column({ type: 'integer' })
  supplierId: number;

  @Column({ type: 'simple-enum', enum: CatalogType })
  catalogType: CatalogType;

  @ManyToOne(() => Supplier, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId', referencedColumnName: 'supplierId' })
  supplier: Supplier;

  @OneToMany(() => ItemInfo, (item) => item.catalog, { cascade: true })
  items: ItemInfo[];
}
