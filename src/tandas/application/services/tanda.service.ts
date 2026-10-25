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
} from '../../domain/ports/in/tanda-use-cases.port';
import { TANDA_REPOSITORY_PORT, type TandaRepositoryPort } from '../../domain/ports/out/tanda-repository.port';
import { NUMBER_REPOSITORY_PORT, type NumberRepositoryPort } from '../../domain/ports/out/number-repository.port';
import { Tanda, TandaStatus } from '../../domain/entities/tanda.entity';
import { InviteCodeGenerator } from '../../domain/utils/invite-code.generator';

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

    // 3. Instanciar y persistir entidad
    const tanda = new Tanda({
      name: command.name,
      description: command.description,
      startDate: command.startDate,
      contributionAmount: command.contributionAmount,
      numParticipants: command.numParticipants,
      numRounds: command.numRounds ?? 1,
      graceDays: command.graceDays ?? 0,
      hasDeadNumber: command.hasDeadNumber ?? false,
      idTandaType: command.idTandaType ?? 1,
      idAdmin: command.idAdmin,
      inviteCode,
      status: 'PENDIENTE',
    });

    const tandaCreada = await this.tandaRepository.create(tanda);

    // 4. Si tiene número muerto, reservar un turno EXTRA en la vuelta 1
    //    (participantes + 1, igual que calcularPlan); no ocupa lugar de nadie
    if (tandaCreada.hasDeadNumber && tandaCreada.idTanda) {
      await this.numberRepository.createNumber({
        idTanda: tandaCreada.idTanda,
        roundNumber: 1,
        numberValue: tandaCreada.numParticipants + 1,
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
    };
  }

  async obtenerPorCodigoInvitacion(inviteCode: string): Promise<Tanda> {
    const cleanCode = inviteCode.trim().toUpperCase();
    const tanda = await this.tandaRepository.findByInviteCode(cleanCode);
    if (!tanda || !tanda.active) {
      throw new NotFoundException(`No se encontró ninguna tanda activa con el código ${cleanCode}`);
    }
    return tanda;
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

        // Turno del usuario en la vuelta 1 (para que el participante pueda pagar)
        const turno = userNums.find((n) => n.roundNumber === 1) ?? userNums[0];

        return {
          ...t.toPrimitives(),
          rolUsuario,
          miNumero: turno
            ? { idNumber: turno.idNumber, numberValue: turno.numberValue, roundNumber: turno.roundNumber }
            : null,
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

    if (tanda.status !== 'PENDIENTE') {
      throw new BadRequestException('Solo es posible unirse a tandas en estado PENDIENTE');
    }

    // Verificar si el usuario ya está unido
    const yaRegistrado = await this.numberRepository.findByUserInTanda(tanda.idTanda!, command.idUser);
    if (yaRegistrado.length > 0) {
      throw new ConflictException('Ya estás registrado como participante en esta tanda');
    }

    // Verificar si hay cupo disponible
    const totalActual = await this.numberRepository.countParticipants(tanda.idTanda!);
    if (totalActual >= tanda.numParticipants) {
      throw new BadRequestException('La tanda ya ha completado el cupo máximo de participantes');
    }

    // Números ocupados en la vuelta 1
    const ocupados = await this.numberRepository.findOccupiedNumbers(tanda.idTanda!, 1);

    let numeroAsignado: number;

    if (command.selectedNumber) {
      if (command.selectedNumber < 1 || command.selectedNumber > tanda.numParticipants) {
        throw new BadRequestException(
          `El número seleccionado debe estar entre 1 y ${tanda.numParticipants}`,
        );
      }
      if (ocupados.includes(command.selectedNumber)) {
        throw new ConflictException(`El turno número ${command.selectedNumber} ya está ocupado`);
      }
      numeroAsignado = command.selectedNumber;
    } else {
      // Asignación automática: primer número libre
      let candidato = 1;
      while (candidato <= tanda.numParticipants) {
        if (!ocupados.includes(candidato)) {
          break;
        }
        candidato++;
      }
      if (candidato > tanda.numParticipants) {
        throw new BadRequestException('No hay turnos disponibles para asignación automática');
      }
      numeroAsignado = candidato;
    }

    // Registrar el número para la tanda
    await this.numberRepository.createNumber({
      idTanda: tanda.idTanda!,
      roundNumber: 1,
      numberValue: numeroAsignado,
      idUser: command.idUser,
      isDeadNumber: false,
      status: 'PENDIENTE',
    });

    // Si con este usuario se llena la tanda, activar automáticamente
    if (totalActual + 1 >= tanda.numParticipants) {
      await this.tandaRepository.updateStatus(tanda.idTanda!, 'ACTIVA');
      tanda.updateStatus('ACTIVA');
    }

    return {
      tanda,
      numeroAsignado,
      isDeadNumber: false,
    };
  }
}
