import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SupplierDocument = Supplier & Document;

@Schema()
export class Supplier {
  @Prop({ required: true })
  supplierId: number;

  @Prop({ required: true })
  supplierName: string;

  @Prop()
  address: string;

  @Prop()
  telephoneNumber: string;

  @Prop()
  faxNumber: string;

  @Prop()
  email: string;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
