import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'suppliers' })
@Check('CHK_supplier_id_positive', 'supplierId > 0')
export class Supplier {
  @PrimaryColumn({ type: 'integer' })
  supplierId: number;

  @Column()
  supplierName: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  telephoneNumber: string | null;

  @Column({ type: 'text', nullable: true })
  faxNumber: string | null;

  @Column({ type: 'text', nullable: true })
  email: string | null;
}
