import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { setupSwagger } from '../src/swagger';

interface OpenApiSpec {
  paths: Record<string, Record<string, { parameters?: { name: string }[] }>>;
  components: {
    schemas: Record<string, { properties?: Record<string, unknown> }>;
  };
}

describe('OpenAPI docs (e2e)', () => {
  let app: NestExpressApplication;
  let spec: OpenApiSpec;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    setupSwagger(app);
    await app.init();
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    spec = res.body as OpenApiSpec;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the interactive docs page', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs')
      .redirects(1)
      .expect(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('documents every endpoint', () => {
    expect(Object.keys(spec.paths).sort()).toEqual([
      '/api/health',
      '/api/products',
      '/api/products/{sku}',
      '/api/products/{sku}/reviews',
    ]);
    expect(
      Object.keys(spec.paths['/api/products/{sku}/reviews']).sort(),
    ).toEqual(['get', 'post']);
  });

  it('documents the search parameters', () => {
    const names = spec.paths['/api/products'].get.parameters!.map(
      (p) => p.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'q',
        'function',
        'applicationArea',
        'region',
        'certifications',
        'includeDiscontinued',
        'sort',
        'page',
        'pageSize',
      ]),
    );
  });

  it('describes the review body without the honeypot field', () => {
    const props = Object.keys(
      spec.components.schemas.CreateReviewDto.properties!,
    );
    expect(props.sort()).toEqual(['authorName', 'body', 'rating', 'title']);
  });
});
