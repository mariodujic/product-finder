import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Shared by main.ts and the e2e tests so both run the exact same app configuration. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // Reject unknown query params instead of silently ignoring typos like ?regoin=EMEA.
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();
}
