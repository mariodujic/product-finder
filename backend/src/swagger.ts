import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const DOCS_PATH = 'api/docs';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Product Finder API')
    .setDescription(
      'Search the specialty chemicals catalogue and read or write product reviews. ' +
        'Product data comes only from the PIM import; reviews are the only write flow.',
    )
    .setVersion('1.0')
    .build();
  return SwaggerModule.createDocument(app, config);
}

/**
 * Interactive docs at /api/docs, raw spec at /api/docs-json. Served under /api
 * so they also work through the web container's nginx proxy.
 */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(DOCS_PATH, app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: `${DOCS_PATH}-json`,
  });
}
