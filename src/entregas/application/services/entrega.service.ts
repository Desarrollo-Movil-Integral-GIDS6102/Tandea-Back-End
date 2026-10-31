import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ENTREGA_REPOSITORY_PORT,
  type EntregaRecord,
  type EntregaRepositoryPort,
} from '../../domain/ports/out/entrega-repository.port';
import type {
  EntregaUseCasesPort,
  RegistrarEntregaCommand,
  UsuarioEntrega,
} from '../../domain/ports/in/entrega-use-cases.port';
import { STORAGE_PORT, type StoragePort } from '../../../pagos/domain/ports/out/storage.port';
import { sumarCentavosExactos, toCentavos } from '../../../pagos/domain/utils/moneda.util';

/**
 * Entrega del dinero del turno con doble confirmación: el organizador la registra con
 * evidencia y el dueño del número confirma que la recibió, lo que cierra el turno.
 */
@Injectable()
export class EntregaService implements EntregaUseCasesPort {
  private readonly logger = new Logger(EntregaService.name);

  constructor(
    @Inject(ENTREGA_REPOSITORY_PORT)
    private readonly repository: EntregaRepositoryPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async registrar(
    command: RegistrarEntregaCommand,
    usuario: UsuarioEntrega,
  ): Promise<EntregaRecord> {
    const { idNumber, transferAmount, cashAmount, evidencia } = command;

    const numero = await this.repository.buscarNumero(idNumber);
    if (!numero) {
      throw new NotFoundException(`El número con id ${idNumber} no existe`);
    }
    if (numero.idAdmin !== usuario.idUser && usuario.role !== 'admin_global') {
      throw new ForbiddenException('Solo el organizador de la tanda puede registrar la entrega');
    }
    if (numero.tandaStatus !== 'ACTIVA') {
      throw new BadRequestException('La tanda no está en curso');
    }
    if (numero.isDeadNumber || numero.idUser === null) {
      throw new BadRequestException('Este número no tiene un participante a quien entregar');
    }
    if (numero.status === 'ENTREGA_PENDIENTE_CONFIRMACION' || numero.status === 'ENTREGADO') {
      throw new ConflictException('Este turno ya tiene una entrega registrada');
    }
    if ((await this.repository.buscarTurnoVigente(numero.idTanda)) !== idNumber) {
      throw new ConflictException(`Aún no es el turno del número #${numero.numberValue}`);
    }

    const totalAmount = (toCentavos(numero.contributionAmount) * numero.numParticipants) / 100;
    if (!sumarCentavosExactos(cashAmount, transferAmount, totalAmount)) {
      throw new BadRequestException(`Los montos deben sumar ${totalAmount.toFixed(2)}`);
    }

    const evidenceUrl = await this.storage.subir(evidencia.buffer, {
      carpeta: 'entregas',
      nombreArchivo: `entrega_numero_${idNumber}_${Date.now()}`,
      mimetype: evidencia.mimetype,
    });

    const idPayout = await this.repository.registrar({
      idNumber,
      transferAmount,
      cashAmount,
      totalAmount,
      evidenceUrl,
    });
    if (idPayout === null) {
      throw new ConflictException('Este turno ya tiene una entrega registrada');
    }

    // shortcut: solo se registra en el log; emitir entrega.registrada queda para BE-NOTIF
    this.logger.log(`entrega.registrada payout=${idPayout} tanda=${numero.idTanda}`);
    return this.buscar(idPayout);
  }

  async obtener(idPayout: number, usuario: UsuarioEntrega): Promise<EntregaRecord> {
    const entrega = await this.buscar(idPayout);
    const participa = entrega.idUser === usuario.idUser || entrega.idAdmin === usuario.idUser;
    if (!participa && usuario.role !== 'admin_global') {
      throw new ForbiddenException('No tienes permisos para ver esta entrega');
    }
    return entrega;
  }

  async confirmar(idPayout: number, usuario: UsuarioEntrega): Promise<EntregaRecord> {
    const entrega = await this.buscarComoReceptor(idPayout, usuario);
    if (!(await this.repository.confirmarRecepcion(idPayout))) {
      throw new ConflictException('Esta entrega ya fue confirmada');
    }
    this.logger.log(`entrega.confirmada payout=${idPayout} tanda=${entrega.idTanda}`);
    return this.buscar(idPayout);
  }

  async reportarProblema(
    idPayout: number,
    motivo: string,
    usuario: UsuarioEntrega,
  ): Promise<void> {
    const entrega = await this.buscarComoReceptor(idPayout, usuario);
    await this.repository.crearDisputa(entrega.idTanda, idPayout, usuario.idUser, motivo);
  }

  private async buscarComoReceptor(
    idPayout: number,
    usuario: UsuarioEntrega,
  ): Promise<EntregaRecord> {
    const entrega = await this.buscar(idPayout);
    if (entrega.idUser !== usuario.idUser) {
      throw new ForbiddenException('Solo quien recibe el dinero puede hacer esto');
    }
    return entrega;
  }

  private async buscar(idPayout: number): Promise<EntregaRecord> {
    const entrega = await this.repository.buscarPorId(idPayout);
    if (!entrega) {
      throw new NotFoundException(`La entrega con id ${idPayout} no existe`);
    }
    return entrega;
  }
}
