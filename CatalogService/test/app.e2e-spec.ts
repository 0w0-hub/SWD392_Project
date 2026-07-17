import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CatalogType } from '../src/catalog/enums/catalog-type.enum';
import { CatalogInfo } from '../src/catalog/schemas/catalog-info.schema';
import { ItemInfo } from '../src/catalog/schemas/item-info.schema';
import { Supplier } from '../src/catalog/schemas/supplier.schema';

describe('CatalogController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.SQLITE_DB_PATH = ':memory:';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const dataSource = app.get(DataSource);
    const supplierRepository = dataSource.getRepository(Supplier);
    const catalogRepository = dataSource.getRepository(CatalogInfo);
    const itemRepository = dataSource.getRepository(ItemInfo);

    const supplier = supplierRepository.create({
      supplierId: 10,
      supplierName: 'Study Books Ltd.',
      address: null,
      telephoneNumber: null,
      faxNumber: null,
      email: 'catalog@example.com',
    });
    await supplierRepository.save(supplier);

    const catalog = catalogRepository.create({
      catalogId: 20,
      catalogDescription: 'Software architecture books',
      supplierId: supplier.supplierId,
      supplier,
      catalogType: CatalogType.Books,
      items: [],
    });
    await catalogRepository.save(catalog);

    await itemRepository.save([
      itemRepository.create({
        itemId: 1002,
        itemDescription: 'Service-Oriented Architecture',
        unitCost: 49.5,
        supplierId: supplier.supplierId,
        itemDetails: 'https://example.com/items/1002',
        supplier,
        catalog,
      }),
      itemRepository.create({
        itemId: 1001,
        itemDescription: 'UML Distilled',
        unitCost: 39.99,
        supplierId: supplier.supplierId,
        itemDetails: 'https://example.com/items/1001',
        supplier,
        catalog,
      }),
    ]);
  });

  it('reports service health', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      service: 'CatalogService',
    });
  });

  it('requestCatalog returns matching catalogs and their items', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog?type=Books')
      .expect(200);

    expect(response.body).toEqual([
      {
        catalogId: 20,
        catalogDescription: 'Software architecture books',
        supplierId: 10,
        catalogType: 'Books',
        items: [
          {
            itemId: 1001,
            itemDescription: 'UML Distilled',
            unitCost: 39.99,
            supplierId: 10,
            itemDetails: 'https://example.com/items/1001',
          },
          {
            itemId: 1002,
            itemDescription: 'Service-Oriented Architecture',
            unitCost: 49.5,
            supplierId: 10,
            itemDetails: 'https://example.com/items/1002',
          },
        ],
      },
    ]);
  });

  it('requestCatalog returns an empty list for a valid type with no catalogs', () => {
    return request(app.getHttpServer())
      .get('/catalog?type=Toys')
      .expect(200)
      .expect([]);
  });

  it.each(['/catalog', '/catalog?type=Clothes'])(
    'rejects an absent or invalid catalog type (%s)',
    (path) => request(app.getHttpServer()).get(path).expect(400),
  );

  it('requestSelection returns the selected item information', () => {
    return request(app.getHttpServer())
      .get('/catalog/item/1001')
      .expect(200)
      .expect({
        itemId: 1001,
        itemDescription: 'UML Distilled',
        unitCost: 39.99,
        supplierId: 10,
        itemDetails: 'https://example.com/items/1001',
      });
  });

  it.each(['/catalog/item/0', '/catalog/item/not-a-number'])(
    'rejects an invalid item id (%s)',
    (path) => request(app.getHttpServer()).get(path).expect(400),
  );

  it('returns 404 when the selected item does not exist', () => {
    return request(app.getHttpServer()).get('/catalog/item/9999').expect(404);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.SQLITE_DB_PATH;
    delete process.env.NODE_ENV;
  });
});
