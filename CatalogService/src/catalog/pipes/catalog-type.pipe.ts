import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { CatalogType } from '../enums/catalog-type.enum';

@Injectable()
export class CatalogTypePipe implements PipeTransform<
  string | undefined,
  CatalogType
> {
  transform(value: string | undefined): CatalogType {
    if (!value || !Object.values(CatalogType).includes(value as CatalogType)) {
      throw new BadRequestException(
        `type must be one of: ${Object.values(CatalogType).join(', ')}`,
      );
    }

    return value as CatalogType;
  }
}
