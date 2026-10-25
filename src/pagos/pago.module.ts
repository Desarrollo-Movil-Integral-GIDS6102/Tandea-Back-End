import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

// Inbound Adapters (HTTP)
import { PagoController } from './infrastructure/adapters/in/http/controllers/pago.controller';

// Outbound Adapters (Drizzle / DB)
import { DrizzlePagoRepository } from './infrastructure/adapters/out/database/drizzle-pago.repository';

// Application
import { PagoService } from './application/services/pago.service';

// Domain Ports
import { PAGO_REPOSITORY_PORT } from './domain/ports/out/pago-repository.port';
import { PAGO_SERVICE_PORT } from './domain/ports/in/pago-use-cases.port';
import { STORAGE_PORT } from './domain/ports/out/storage.port';
import { EVIDENCE_REPOSITORY_PORT } from './domain/ports/out/evidence-repository.port';
import { OCR_SERVICE_PORT } from './domain/ports/out/ocr-service.port';
import { PAGO_EVENTS_PORT } from './domain/ports/out/pago-events.port';

// Storage & Evidence Adapters
import { CloudinaryAdapter } from './infrastructure/adapters/out/storage/cloudinary.adapter';
import { DrizzleEvidenceRepository } from './infrastructure/adapters/out/database/drizzle-evidence.repository';

// OCR & Eventos
import { OcrGoogleVisionAdapter } from './infrastructure/adapters/out/ocr/ocr-google-vision.adapter';
import { LogPagoEventsAdapter } from './infrastructure/adapters/out/events/log-pago-events.adapter';

/**
 * PagoModule — Módulo de configuración de Inyección de Dependencias
 * para la Arquitectura Hexagonal.
 *
 * Mapeo de Puertos y Adaptadores:
 *  - Puerto de Salida: PAGO_REPOSITORY_PORT ➔ Adaptador: DrizzlePagoRepository
 *  - Puerto de Salida: STORAGE_PORT ➔ Adaptador: CloudinaryAdapter
 *  - Puerto de Salida: EVIDENCE_REPOSITORY_PORT ➔ Adaptador: DrizzleEvidenceRepository
 *  - Puerto de Salida: OCR_SERVICE_PORT ➔ Adaptador: OcrGoogleVisionAdapter (AP-04)
 *  - Puerto de Salida: PAGO_EVENTS_PORT ➔ Adaptador: LogPagoEventsAdapter (temporal, BE-NOTIF)
 *  - Puerto de Entrada: PAGO_SERVICE_PORT ➔ Servicio de Aplicación: PagoService
 */
@Module({
  imports: [DatabaseModule],
  controllers: [PagoController],
  providers: [
    // Vinculación del Puerto de Salida con el Adaptador de Persistencia
    {
      provide: PAGO_REPOSITORY_PORT,
      useClass: DrizzlePagoRepository,
    },
    // Vinculación del Puerto de Salida de Almacenamiento con Cloudinary
    {
      provide: STORAGE_PORT,
      useClass: CloudinaryAdapter,
    },
    // Vinculación del Puerto de Evidencias con Drizzle
    {
      provide: EVIDENCE_REPOSITORY_PORT,
      useClass: DrizzleEvidenceRepository,
    },
    // Vinculación del Puerto de OCR con Google Cloud Vision (sin GOOGLE_VISION_KEY queda desactivado)
    {
      provide: OCR_SERVICE_PORT,
      useClass: OcrGoogleVisionAdapter,
    },
    // TODO([BE-NOTIF] Emitir y escuchar eventos internos): usar el adaptador del bus de eventos
    {
      provide: PAGO_EVENTS_PORT,
      useClass: LogPagoEventsAdapter,
    },
    // Vinculación del Puerto de Entrada con el Servicio de Aplicación
    {
      provide: PAGO_SERVICE_PORT,
      useClass: PagoService,
    },
    PagoService,
    CloudinaryAdapter,
    DrizzleEvidenceRepository,
  ],
  exports: [
    PAGO_SERVICE_PORT,
    PagoService,
    STORAGE_PORT,
    EVIDENCE_REPOSITORY_PORT,
  ],
})
export class PagoModule {}

