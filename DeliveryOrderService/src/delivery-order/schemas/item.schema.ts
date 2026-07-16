import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Item {
  @Prop({ required: true })
  itemId: number;

  @Prop({ required: true })
  unitCost: number;

  @Prop({ required: true })
  quantity: number;
}

export const ItemSchema = SchemaFactory.createForClass(Item);
