import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ZodValidationExceptionFilter } from './common/filters/zod-validation.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // ── Filtro global para ZodError → 422 ────────────────────────────────────
  app.useGlobalFilters(new ZodValidationExceptionFilter());

  // ── Prefijo global de la API ──────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // ── CORS ──────────────────────────────────────────────────────────────────
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Tandea API corriendo en: http://localhost:${port}/api/v1`);
}

void bootstrap();
