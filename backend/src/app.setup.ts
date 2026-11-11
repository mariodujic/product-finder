import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

/** Shared by main.ts and the e2e tests so both run the exact same app configuration. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // Reject unknown fields instead of silently ignoring typos like ?regoin=EMEA.
      forbidNonWhitelisted: true,
    }),
  );
  // The API runs behind exactly one reverse proxy (nginx), which overwrites
  // X-Forwarded-For with the address it saw. Trusting one hop makes rate limiting
  // use the real client IP; a client-supplied X-Forwarded-For can't bypass it.
  // (Trusting "private networks" instead would be spoofable locally, because
  // Docker's gateway address is itself private.)
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
}
