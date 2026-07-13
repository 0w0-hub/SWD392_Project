import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ItemInfoDocument = ItemInfo & Document;

@Schema()
export class ItemInfo {
  @Prop({ required: true })
  itemId: number;

  @Prop({ required: true })
  itemDescription: string;

  @Prop({ required: true })
  unitCost: number;

  @Prop({ required: true })
  supplierId: number;

  @Prop()
  itemDetails: string;
}

export const ItemInfoSchema = SchemaFactory.createForClass(ItemInfo);
