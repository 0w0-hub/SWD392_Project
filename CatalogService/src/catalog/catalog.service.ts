import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CatalogInfo, CatalogInfoDocument } from './schemas/catalog-info.schema';
import { ItemInfo, ItemInfoDocument } from './schemas/item-info.schema';
import { ICatalogService } from './interfaces/icatalog.service';
import { CatalogType } from './enums/catalog-type.enum';

@Injectable()
export class CatalogService implements ICatalogService {
  constructor(
    @InjectModel(CatalogInfo.name) private catalogInfoModel: Model<CatalogInfoDocument>,
    @InjectModel(ItemInfo.name) private itemInfoModel: Model<ItemInfoDocument>,
  ) {}

  async requestCatalog(catalogType: CatalogType): Promise<CatalogInfo[]> {
    return this.catalogInfoModel.find({ catalogType }).populate('items').exec();
  }

  async requestSelection(itemId: number): Promise<ItemInfo> {
    const item = await this.itemInfoModel.findOne({ itemId }).exec();
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }
    return item;
  }
}
