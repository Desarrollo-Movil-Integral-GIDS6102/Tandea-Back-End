import { Injectable, Inject } from '@nestjs/common';
import {
  ElegirNumeroUseCasePort,
  ElegirNumeroCommand,
} from '../../domain/ports/in/elegir-numero-use-case.port';
import {
  NUMBER_REPOSITORY_PORT,
  type NumberRepositoryPort,
} from '../../domain/ports/out/number-repository.port';
import {
  TANDA_REPOSITORY_PORT,
  type TandaRepositoryPort,
} from '../../domain/ports/out/tanda-repository.port';
import { NumeroTanda } from '../../domain/entities/numero-tanda.entity';
import {
  NumeroInexistenteError,
  NumeroFueraDeRangoError,
} from '../../domain/errors/numero.errors';

/**
 * Servicio de aplicación para el caso de uso Elegir Número (AP-02).
 *
 * En Arquitectura Hexagonal:
 * - Inyecta exclusivamente los puertos por su Symbol token (@Inject(TOKEN)).
 * - NUNCA importa adaptadores ni repositorios concretos.
 * - Delega la concurrencia y atomicidad a la capa de infraestructura / base de datos.
 */
@Injectable()
export class ElegirNumeroService implements ElegirNumeroUseCasePort {
  constructor(
    @Inject(NUMBER_REPOSITORY_PORT)
    private readonly numberRepository: NumberRepositoryPort,
    @Inject(TANDA_REPOSITORY_PORT)
    private readonly tandaRepository: TandaRepositoryPort,
  ) {}

  async elegirNumero(command: ElegirNumeroCommand): Promise<NumeroTanda> {
    const roundNumber = command.roundNumber ?? 1;

    // 1. Validar existencia y vigencia de la tanda
    const tanda = await this.tandaRepository.findById(command.idTanda);
    if (!tanda || !tanda.active) {
      throw new NumeroInexistenteError(command.valorNumero, command.idTanda);
    }

    // 2. Los participantes eligen #1..#N; el #0 es el número muerto y nunca se elige
    if (command.valorNumero < 1 || command.valorNumero > tanda.numParticipants) {
      throw new NumeroFueraDeRangoError(command.valorNumero, tanda.numParticipants);
    }

    // 3. Asignación atómica mediante el puerto de salida
    return await this.numberRepository.asignarSiLibre(
      command.idTanda,
      roundNumber,
      command.valorNumero,
      command.idUsuario,
    );
  }
}
