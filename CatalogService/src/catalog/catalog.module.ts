import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogInfo, CatalogInfoSchema } from './schemas/catalog-info.schema';
import { ItemInfo, ItemInfoSchema } from './schemas/item-info.schema';
import { Supplier, SupplierSchema } from './schemas/supplier.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CatalogInfo.name, schema: CatalogInfoSchema },
      { name: ItemInfo.name, schema: ItemInfoSchema },
      { name: Supplier.name, schema: SupplierSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
