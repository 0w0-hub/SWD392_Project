import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogType } from './enums/catalog-type.enum';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async requestCatalog(@Query('type') catalogType: CatalogType) {
    return this.catalogService.requestCatalog(catalogType);
  }

  @Get('item/:id')
  async requestSelection(@Param('id', ParseIntPipe) itemId: number) {
    return this.catalogService.requestSelection(itemId);
  }
}
