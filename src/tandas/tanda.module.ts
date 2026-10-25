import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TandaController } from './infrastructure/adapters/in/http/tanda.controller';
import { TandaService } from './application/services/tanda.service';
import { DrizzleTandaRepository } from './infrastructure/adapters/out/database/drizzle-tanda.repository';
import { TANDA_REPOSITORY_PORT } from './domain/ports/out/tanda-repository.port';
import { NUMBER_REPOSITORY_PORT } from './domain/ports/out/number-repository.port';
import { TANDA_USE_CASES_PORT } from './domain/ports/in/tanda-use-cases.port';
import { CREATE_TANDA_USE_CASE_PORT } from './domain/ports/in/create-tanda-use-case.port';

@Module({
  imports: [DatabaseModule],
  controllers: [TandaController],
  providers: [
    TandaService,
    DrizzleTandaRepository,
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
  ],
  exports: [
    TandaService,
    TANDA_USE_CASES_PORT,
    CREATE_TANDA_USE_CASE_PORT,
  ],
})
export class TandaModule {}
