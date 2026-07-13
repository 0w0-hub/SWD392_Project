import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CatalogModule } from "./catalog/catalog.module";

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/catalog'),
    CatalogModule,
  ],
})
export class AppModule {}