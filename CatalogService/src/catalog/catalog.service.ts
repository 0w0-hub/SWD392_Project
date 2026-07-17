import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogInfo } from './schemas/catalog-info.schema';
import { ItemInfo } from './schemas/item-info.schema';
import { ICatalogService } from './interfaces/icatalog.service';
import { CatalogType } from './enums/catalog-type.enum';

@Injectable()
export class CatalogService implements ICatalogService {
  constructor(
    @InjectRepository(CatalogInfo)
    private readonly catalogInfoRepository: Repository<CatalogInfo>,
    @InjectRepository(ItemInfo)
    private readonly itemInfoRepository: Repository<ItemInfo>,
  ) {}

  async requestCatalog(catalogType: CatalogType): Promise<CatalogInfo[]> {
    if (!Object.values(CatalogType).includes(catalogType)) {
      throw new BadRequestException(
        `Catalog type must be one of: ${Object.values(CatalogType).join(', ')}`,
      );
    }

    const catalogs = await this.catalogInfoRepository.find({
      where: { catalogType },
      relations: { items: true },
      order: { catalogId: 'ASC' },
    });

    for (const catalog of catalogs) {
      catalog.items.sort((left, right) => left.itemId - right.itemId);
    }

    return catalogs;
  }

  async requestSelection(itemId: number): Promise<ItemInfo> {
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new BadRequestException('itemId must be a positive integer');
    }

    const item = await this.itemInfoRepository.findOneBy({ itemId });
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }
    return item;
  }
}
