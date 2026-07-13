import { CatalogInfo } from '../schemas/catalog-info.schema';
import { ItemInfo } from '../schemas/item-info.schema';
import { CatalogType } from '../enums/catalog-type.enum';

export interface ICatalogService {
  requestCatalog(catalogType: CatalogType): Promise<CatalogInfo[]>;
  requestSelection(itemId: number): Promise<ItemInfo>;
}
