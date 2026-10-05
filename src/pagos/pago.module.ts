import { Module } from '@nestjs/common';
import { PagoController } from './controllers/pago.controller';
import { PagoService } from './services/pago.service';
import { PagoRepository } from './repositories/pago.repository';
import { DatabaseModule } from '../database/database.module';

/**
 * PagoModule — Módulo autocontenido del dominio de Pagos.
 *
 * Principios del Monolito Modular:
 *  - Importa DatabaseModule para obtener el proveedor de Drizzle.
 *  - No exporta nada que no deba ser accedido desde otros módulos.
 *  - Si otro módulo necesita datos de Pagos, lo hace a través de PagoService (nunca del Repository).
 */
@Module({
  imports: [DatabaseModule],
  controllers: [PagoController],
  providers: [PagoService, PagoRepository],
  exports: [PagoService], // Solo exportamos el Service, nunca el Repository
})
export class PagoModule {}
