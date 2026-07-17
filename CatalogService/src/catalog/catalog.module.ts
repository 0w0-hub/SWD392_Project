import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogInfo } from './schemas/catalog-info.schema';
import { ItemInfo } from './schemas/item-info.schema';
import { Supplier } from './schemas/supplier.schema';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogInfo, ItemInfo, Supplier])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
