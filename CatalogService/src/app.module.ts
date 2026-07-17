import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrokerModule } from './broker/broker.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'better-sqlite3',
        database: process.env.SQLITE_DB_PATH ?? 'catalog.sqlite',
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    CatalogModule,
    BrokerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
