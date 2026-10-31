import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  TandaUseCasesPort,
  CreateTandaCommand,
  UpdateTandaCommand,
  ListTandasQuery,
  PaginatedTandasResult,
  TandaDetalle,
  JoinTandaCommand,
  JoinTandaResult,
  TandaConDisponibles,
  SeguimientoTanda,
} from '../../domain/ports/in/tanda-use-cases.port';
import { NumeroYaTomadoError } from '../../domain/errors/numero.errors';
import { NUMERO_MUERTO } from '../../domain/entities/numero-tanda.entity';
import { sortearNumeros } from '../../domain/services/sortear-numeros';
import { calcularPlan } from '../../domain/services/calcular-plan';
import { TANDA_REPOSITORY_PORT, type TandaRepositoryPort } from '../../domain/ports/out/tanda-repository.port';
import { NUMBER_REPOSITORY_PORT, type NumberRepositoryPort } from '../../domain/ports/out/number-repository.port';
import { Tanda, TandaStatus } from '../../domain/entities/tanda.entity';
import { InviteCodeGenerator } from '../../domain/utils/invite-code.generator';

const numeroTomadoMensaje = (n: number): string =>
  `El número #${n} ya fue tomado por otro participante. Elige otro.`;

@Injectable()
export class TandaService implements TandaUseCasesPort {
  constructor(
    @Inject(TANDA_REPOSITORY_PORT)
    private readonly tandaRepository: TandaRepositoryPort,
    @Inject(NUMBER_REPOSITORY_PORT)
    private readonly numberRepository: NumberRepositoryPort,
  ) {}

  async crearTanda(command: CreateTandaCommand): Promise<Tanda> {
    // 1. Validar regla de negocio de participantes antes de consultar BD o generar código
    if (
      command.numParticipants === undefined ||
      command.numParticipants === null ||
      typeof command.numParticipants !== 'number' ||
      !Number.isInteger(command.numParticipants) ||
      command.numParticipants < 3
    ) {
      throw new BadRequestException('Una tanda requiere al menos 3 participantes');
    }

    // 2. Generar código único y verificar colisión en BD
    let inviteCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      inviteCode = InviteCodeGenerator.generate();
      const existing = await this.tandaRepository.findByInviteCode(inviteCode);
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new ConflictException('No se pudo generar un código único de tanda. Reintente.');
    }

    // 3. Instanciar y persistir entidad. El número muerto suma un turno por vuelta y
    // recorre la fecha final un periodo más (una quincena, un día, etc.)
    const periodicity = command.periodicity ?? 'quincenal';
    const numRounds = command.numRounds ?? 1;
    const { fechaFin } = calcularPlan({
      periodicidad: periodicity,
      montoCuota: command.contributionAmount,
      numParticipantes: command.numParticipants,
      numVueltas: numRounds,
      tieneNumeroMuerto: command.hasDeadNumber ?? false,
      fechaInicio: new Date(`${command.startDate}T12:00:00.000Z`),
    });

    const tanda = new Tanda({
      name: command.name,
      description: command.description,
      startDate: command.startDate,
      endDate: fechaFin.toISOString().slice(0, 10),
      contributionAmount: command.contributionAmount,
      numParticipants: command.numParticipants,
      numRounds,
      graceDays: command.graceDays ?? 0,
      periodicity,
      hasDeadNumber: command.hasDeadNumber ?? false,
      idTandaType: command.idTandaType ?? 1,
      idAdmin: command.idAdmin,
      inviteCode,
      status: 'PENDIENTE',
    });

    const tandaCreada = await this.tandaRepository.create(tanda);

    // 4. Si tiene número muerto configurado, reservar el turno en la vuelta 1
    if (tandaCreada.hasDeadNumber && tandaCreada.idTanda) {
      await this.numberRepository.createNumber({
        idTanda: tandaCreada.idTanda,
        roundNumber: 1,
        numberValue: NUMERO_MUERTO, // Siempre #0: los participantes usan #1..#N
        idUser: null,
        isDeadNumber: true,
        status: 'PENDIENTE',
      });
    }

    return tandaCreada;
  }

  async obtenerTandaPorId(idTanda: number, userId: number, role: string): Promise<TandaDetalle> {
    const tanda = await this.tandaRepository.findById(idTanda);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`Tanda con id ${idTanda} no encontrada`);
    }

    const isOwner = tanda.idAdmin === userId;
    const userNumbers = await this.numberRepository.findByUserInTanda(idTanda, userId);
    const isParticipant = userNumbers.length > 0;
    const isAdminGlobal = role === 'admin_global';

    if (!isOwner && !isParticipant && !isAdminGlobal) {
      throw new ForbiddenException('No tienes permisos para visualizar esta tanda');
    }

    const participantes = await this.numberRepository.findNumbersByTanda(idTanda);

    let rolUsuario: 'DUENO' | 'PARTICIPANTE' | 'AMBOS' | 'ADMIN_GLOBAL' = 'PARTICIPANTE';
    if (isAdminGlobal) {
      rolUsuario = 'ADMIN_GLOBAL';
    } else if (isOwner && isParticipant) {
      rolUsuario = 'AMBOS';
    } else if (isOwner) {
      rolUsuario = 'DUENO';
    }

    return {
      ...tanda.toPrimitives(),
      rolUsuario,
      participantes,
      // Se toman de `participantes` porque ahí viene el estado de pago de cada número
      misNumeros: participantes.filter((n) => n.idUser === userId),
      numerosDisponibles: tanda.aceptaParticipantes ? await this.numerosLibres(tanda) : [],
    };
  }

  async obtenerSeguimiento(idTanda: number, userId: number, role: string): Promise<SeguimientoTanda> {
    const tanda = await this.tandaRepository.findById(idTanda);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`Tanda con id ${idTanda} no encontrada`);
    }
    if (tanda.idAdmin !== userId && role !== 'admin_global') {
      throw new ForbiddenException('Solo el organizador puede ver el seguimiento de pagos');
    }

    const numeros = await this.numberRepository.findNumbersByTanda(idTanda);
    return {
      tanda: {
        idTanda: tanda.idTanda,
        name: tanda.name,
        numRounds: tanda.numRounds,
        contributionAmount: tanda.contributionAmount,
      },
      vueltaActual: 1,
      cuota: tanda.contributionAmount,
      // shortcut: el número muerto no paga y aquí se omite; la tarjeta SP-4-[FE-AJUSTE] lo agrega
      participantes: numeros
        .filter((n) => !n.isDeadNumber)
        .map((n) => ({
          idNumber: n.idNumber,
          numberValue: n.numberValue,
          nombre: [n.userName, n.userLastName].filter(Boolean).join(' '),
          isDeadNumber: false,
          idPayment: n.idPayment ?? null,
          estadoPago: n.estadoPago ?? 'PENDIENTE',
          montoPagado: n.montoPagado ?? 0,
          fechaPago: n.fechaPago ?? null,
        })),
    };
  }

  async obtenerPorCodigoInvitacion(inviteCode: string): Promise<TandaConDisponibles> {
    const cleanCode = inviteCode.trim().toUpperCase();
    const tanda = await this.tandaRepository.findByInviteCode(cleanCode);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`No se encontró ninguna tanda activa con el código ${cleanCode}`);
    }
    return {
      ...tanda.toPrimitives(),
      numerosDisponibles: tanda.aceptaParticipantes ? await this.numerosLibres(tanda) : [],
    };
  }

  async listarTandas(query: ListTandasQuery, userId: number, role: string): Promise<PaginatedTandasResult> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const search = query.search || query.name;

    const { data: tandas, total } = await this.tandaRepository.findAll({
      userId,
      userRole: role,
      scope: query.scope ?? 'todos',
      name: search,
      status: query.status,
      startDateFrom: query.startDateFrom,
      startDateTo: query.startDateTo,
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
      page,
      limit,
    });

    const dataWithRoles = await Promise.all(
      tandas.map(async (t) => {
        const isOwner = t.idAdmin === userId;
        const userNums = await this.numberRepository.findByUserInTanda(t.idTanda!, userId);
        const isParticipant = userNums.length > 0;

        let rolUsuario: 'DUENO' | 'PARTICIPANTE' | 'AMBOS' | 'ADMIN_GLOBAL' = 'PARTICIPANTE';
        if (role === 'admin_global') {
          rolUsuario = 'ADMIN_GLOBAL';
        } else if (isOwner && isParticipant) {
          rolUsuario = 'AMBOS';
        } else if (isOwner) {
          rolUsuario = 'DUENO';
        }

        // Pendiente: tanda en curso con algún número sin pago (los del usuario; todos si es organizador)
        const sinPago =
          t.status === 'ACTIVA'
            ? await this.numberRepository.countNumbersWithoutPayment(
                t.idTanda!,
                query.scope === 'dueno' ? undefined : userId,
              )
            : 0;

        return {
          ...t.toPrimitives(),
          rolUsuario,
          indicadorPago: sinPago > 0 ? ('pendiente' as const) : ('al_dia' as const),
        };
      }),
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: dataWithRoles,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async actualizarTanda(
    idTanda: number,
    command: UpdateTandaCommand,
    userId: number,
    role: string,
  ): Promise<Tanda> {
    const tanda = await this.tandaRepository.findById(idTanda);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`Tanda con id ${idTanda} no encontrada`);
    }

    const isOwner = tanda.idAdmin === userId;
    const isAdminGlobal = role === 'admin_global';

    if (!isOwner && !isAdminGlobal) {
      throw new ForbiddenException('Solo el organizador o administrador puede editar la tanda');
    }

    if (tanda.status === 'FINALIZADA' || tanda.status === 'CANCELADA') {
      throw new BadRequestException('No se puede editar una tanda finalizada o cancelada');
    }

    tanda.updateDetails(command.name, command.description);
    return await this.tandaRepository.update(tanda);
  }

  async cambiarEstadoTanda(
    idTanda: number,
    status: TandaStatus,
    userId: number,
    role: string,
  ): Promise<Tanda> {
    const tanda = await this.tandaRepository.findById(idTanda);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`Tanda con id ${idTanda} no encontrada`);
    }

    const isOwner = tanda.idAdmin === userId;
    const isAdminGlobal = role === 'admin_global';

    if (!isOwner && !isAdminGlobal) {
      throw new ForbiddenException('Solo el organizador o administrador puede cambiar el estado de la tanda');
    }

    if (status === 'ACTIVA' && tanda.status === 'PENDIENTE') {
      const libres = await this.numerosLibres(tanda);
      if (libres.length > 0) {
        throw new BadRequestException(
          `Faltan ${libres.length} números por apartar antes de iniciar la tanda`,
        );
      }
    }

    tanda.updateStatus(status);
    return await this.tandaRepository.updateStatus(idTanda, status);
  }

  async eliminarTanda(idTanda: number, userId: number, role: string): Promise<void> {
    const tanda = await this.tandaRepository.findById(idTanda);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`Tanda con id ${idTanda} no encontrada`);
    }

    const isOwner = tanda.idAdmin === userId;
    const isAdminGlobal = role === 'admin_global';

    if (!isOwner && !isAdminGlobal) {
      throw new ForbiddenException('Solo el organizador o administrador puede eliminar la tanda');
    }

    await this.tandaRepository.softDelete(idTanda);
  }

  async unirseTanda(command: JoinTandaCommand): Promise<JoinTandaResult> {
    const cleanCode = command.inviteCode.trim().toUpperCase();
    const tanda = await this.tandaRepository.findByInviteCode(cleanCode);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`No existe una tanda activa con el código ${cleanCode}`);
    }

    // ACTIVA no bloquea: se puede unir mientras queden números libres
    if (!tanda.aceptaParticipantes) {
      throw new BadRequestException(
        `La tanda está ${tanda.status.toLowerCase()} y ya no acepta participantes`,
      );
    }

    const libres = await this.numerosLibres(tanda);
    if (libres.length === 0) {
      throw new BadRequestException('La tanda ya no tiene números disponibles');
    }

    // Un usuario (incluido el organizador) puede apartar uno o varios números
    let pedidos: number[];
    let consecutivos: boolean | undefined;
    if (tanda.esSorteo) {
      // Por sorteo el sistema asigna al azar entre los libres; el participante solo dice cuántos
      if (command.selectedNumbers?.length) {
        throw new BadRequestException('En una tanda por sorteo los números se asignan al azar');
      }
      const cantidad = command.cantidad ?? 1;
      if (cantidad > libres.length) {
        throw new BadRequestException(
          `Solo quedan ${libres.length} números disponibles en la tanda`,
        );
      }
      ({ numeros: pedidos, consecutivos } = sortearNumeros(
        libres,
        cantidad,
        command.consecutivos ?? false,
      ));
    } else {
      // En Tradicional el participante elige; nunca se reasigna otro número
      if (!command.selectedNumbers?.length) {
        throw new BadRequestException('Elige al menos un número');
      }
      pedidos = [...new Set(command.selectedNumbers)];
      for (const n of pedidos) {
        if (n < 1 || n > tanda.numParticipants) {
          throw new BadRequestException(
            `El número seleccionado debe estar entre 1 y ${tanda.numParticipants}`,
          );
        }
        if (!libres.includes(n)) {
          throw new ConflictException(numeroTomadoMensaje(n));
        }
      }
    }

    try {
      await this.numberRepository.createNumbers(
        pedidos.map((numberValue) => ({
          idTanda: tanda.idTanda!,
          roundNumber: 1,
          numberValue,
          idUser: command.idUser,
          isDeadNumber: false,
          status: 'PENDIENTE',
        })),
      );
    } catch (error) {
      if (error instanceof NumeroYaTomadoError) {
        // El insert es una sola sentencia: no se apartó ninguno de los números pedidos
        throw new ConflictException(
          tanda.esSorteo
            ? 'Otro participante tomó números al mismo tiempo. Intenta de nuevo.'
            : numeroTomadoMensaje(error.numero),
        );
      }
      throw error;
    }

    // La tanda sigue PENDIENTE: el organizador la inicia cuando estén todos los números apartados
    return {
      tanda,
      numeroAsignado: pedidos[0],
      numerosAsignados: pedidos,
      consecutivos,
      isDeadNumber: false,
    };
  }

  /** Números de la vuelta 1 que nadie ha apartado (el número muerto queda fuera del rango). */
  private async numerosLibres(tanda: Tanda): Promise<number[]> {
    const ocupados = await this.numberRepository.findOccupiedNumbers(tanda.idTanda!, 1);
    return Array.from({ length: tanda.numParticipants }, (_, i) => i + 1).filter(
      (n) => !ocupados.includes(n),
    );
  }
}
