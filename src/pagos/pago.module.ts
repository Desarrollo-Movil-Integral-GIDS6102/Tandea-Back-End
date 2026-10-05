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

/**
 * PagoModule — Módulo de configuración de Inyección de Dependencias
 * para la Arquitectura Hexagonal.
 *
 * Mapeo de Puertos y Adaptadores:
 *  - Puerto de Salida: PAGO_REPOSITORY_PORT ➔ Adaptador: DrizzlePagoRepository
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
    // Vinculación del Puerto de Entrada con el Servicio de Aplicación
    {
      provide: PAGO_SERVICE_PORT,
      useClass: PagoService,
    },
    PagoService,
  ],
  exports: [PAGO_SERVICE_PORT, PagoService],
})
export class PagoModule {}
