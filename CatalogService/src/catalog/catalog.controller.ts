import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogType } from './enums/catalog-type.enum';
import { CatalogTypePipe } from './pipes/catalog-type.pipe';
import { PositiveIntegerPipe } from './pipes/positive-integer.pipe';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async requestCatalog(
    @Query('type', CatalogTypePipe) catalogType: CatalogType,
  ) {
    return this.catalogService.requestCatalog(catalogType);
  }

  @Get('item/:id')
  async requestSelection(@Param('id', PositiveIntegerPipe) itemId: number) {
    return this.catalogService.requestSelection(itemId);
  }
}
