import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TandaController } from './infrastructure/adapters/in/http/tanda.controller';
import { TandaService } from './application/services/tanda.service';
import { ElegirNumeroService } from './application/services/elegir-numero.service';
import { DrizzleTandaRepository } from './infrastructure/adapters/out/database/drizzle-tanda.repository';
import { TANDA_REPOSITORY_PORT } from './domain/ports/out/tanda-repository.port';
import { NUMBER_REPOSITORY_PORT } from './domain/ports/out/number-repository.port';
import { TANDA_USE_CASES_PORT } from './domain/ports/in/tanda-use-cases.port';
import { CREATE_TANDA_USE_CASE_PORT } from './domain/ports/in/create-tanda-use-case.port';
import { ELEGIR_NUMERO_USE_CASE_PORT } from './domain/ports/in/elegir-numero-use-case.port';
import { CoberturaTurnosService } from './application/services/cobertura-turnos.service';
import { DrizzleCoberturaRepository } from './infrastructure/adapters/out/database/drizzle-cobertura.repository';
import { EventEmitterTurnoEventsAdapter } from './infrastructure/adapters/out/events/event-emitter-turno-events.adapter';
import { CoberturaCron } from './infrastructure/adapters/in/scheduler/cobertura.cron';
import { COBERTURA_REPOSITORY_PORT } from './domain/ports/out/cobertura-repository.port';
import { TURNO_EVENTS_PORT } from './domain/ports/out/turno-events.port';

@Module({
  imports: [DatabaseModule],
  controllers: [TandaController],
  providers: [
    TandaService,
    ElegirNumeroService,
    CoberturaTurnosService,
    CoberturaCron,
    DrizzleTandaRepository,
    { provide: COBERTURA_REPOSITORY_PORT, useClass: DrizzleCoberturaRepository },
    { provide: TURNO_EVENTS_PORT, useClass: EventEmitterTurnoEventsAdapter },
    {
      provide: TANDA_REPOSITORY_PORT,
      useExisting: DrizzleTandaRepository,
    },
    {
      provide: NUMBER_REPOSITORY_PORT,
      useExisting: DrizzleTandaRepository,
    },
    {
      provide: TANDA_USE_CASES_PORT,
      useExisting: TandaService,
    },
    {
      provide: CREATE_TANDA_USE_CASE_PORT,
      useExisting: TandaService,
    },
    {
      provide: ELEGIR_NUMERO_USE_CASE_PORT,
      useExisting: ElegirNumeroService,
    },
  ],
  exports: [
    TandaService,
    ElegirNumeroService,
    CoberturaTurnosService,
    TANDA_USE_CASES_PORT,
    CREATE_TANDA_USE_CASE_PORT,
    ELEGIR_NUMERO_USE_CASE_PORT,
  ],
})
export class TandaModule {}
