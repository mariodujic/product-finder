import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductDetail, ProductSearchResult } from './product.types';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Search, filter, sort and page the catalogue. Also returns facet counts for the filter UI. */
  @Get()
  @ApiOperation({
    summary: 'Search the catalogue',
    description:
      'Search, filter, sort and page listed products. OR within a filter, AND across filters. ' +
      'Facet counts show how many products each filter value would return.',
  })
  @ApiOkResponse({ type: ProductSearchResult })
  @ApiBadRequestResponse({ description: 'Invalid or unknown query parameter.' })
  search(@Query() query: ProductQueryDto): Promise<ProductSearchResult> {
    return this.products.search(query);
  }

  @Get(':sku')
  @ApiOperation({
    summary: 'Get one product',
    description:
      'Also returns discontinued and delisted products, so shared links keep working. Check status and isListed.',
  })
  @ApiParam({ name: 'sku', example: 'P-10001' })
  @ApiOkResponse({ type: ProductDetail })
  @ApiNotFoundResponse({
    description: 'The SKU has never been in the catalogue.',
  })
  findOne(@Param('sku') sku: string): Promise<ProductDetail> {
    return this.products.findBySku(sku);
  }
}
