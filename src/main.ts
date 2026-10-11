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
  app.setGlobalPrefix('api/v1');

  // ── CORS ──────────────────────────────────────────────────────────────────
  const corsOriginEnv = process.env.CORS_ORIGIN ?? '*';
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin encabezado Origin (móvil nativo, curl, postman)
      if (!origin) {
        return callback(null, true);
      }

      // Permitir comodín '*', entorno de desarrollo o cualquier puerto localhost/127.0.0.1
      if (
        corsOriginEnv === '*' ||
        process.env.NODE_ENV !== 'production' ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      const allowedOrigins = corsOriginEnv.split(',').map((o) => o.trim());
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error('Bloqueado por política de CORS'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Tandea API corriendo en: http://localhost:${port}/api/v1`);
}

void bootstrap();
