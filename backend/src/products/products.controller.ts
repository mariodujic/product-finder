import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductDetail, ProductSearchResult } from './product.types';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Search, filter, sort and page the catalogue. Also returns facet counts for the filter UI. */
  @Get()
  search(@Query() query: ProductQueryDto): Promise<ProductSearchResult> {
    return this.products.search(query);
  }

  @Get(':sku')
  findOne(@Param('sku') sku: string): Promise<ProductDetail> {
    return this.products.findBySku(sku);
  }
}
