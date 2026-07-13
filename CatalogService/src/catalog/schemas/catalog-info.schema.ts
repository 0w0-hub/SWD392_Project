import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CatalogType } from '../enums/catalog-type.enum';
import { ItemInfo } from './item-info.schema';

export type CatalogInfoDocument = CatalogInfo & Document;

@Schema()
export class CatalogInfo {
  @Prop({ required: true })
  catalogId: number;

  @Prop({ required: true })
  catalogDescription: string;

  @Prop({ required: true })
  supplierId: number;

  @Prop({ type: String, enum: CatalogType, required: true })
  catalogType: CatalogType;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'ItemInfo' }] })
  items: ItemInfo[];
}

export const CatalogInfoSchema = SchemaFactory.createForClass(CatalogInfo);
