import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  AdminDisputasUseCasePort,
  CrearDisputaCommand,
  DisputaDetalle,
  DisputaResumen,
  ListarDisputasFiltro,
  ResolverDisputaCommand,
} from '../../domain/ports/in/admin-disputas-use-case.port';
import {
  ADMIN_DISPUTAS_REPOSITORY_PORT,
  type AdminDisputasRepositoryPort,
} from '../../domain/ports/out/admin-disputas-repository.port';
import {
  ADMIN_EVENTS_PORT,
  type AdminEventsPort,
} from '../../domain/ports/out/admin-events.port';

export const ACCION_DISPUTA_RESUELTA = 'DISPUTA_RESUELTA';

/**
 * [SP-4 BE-ADMIN / INT-ADMIN] Gestión de disputas y registro de su resolución en `audit_log`.
 *
 *  - `POST /disputas`: solo miembros de la tanda (participante u organizador).
 *  - `GET /admin/disputas` y `GET /admin/disputas/:id`: lista y detalle para `admin_global`.
 *  - `PATCH /admin/disputas/:id/resolver`: resuelve con `{ accion: mantener|revertir|suspender, notas }`,
 *    guarda en `audit_log` dentro de la misma transacción (sin modificar montos directamente)
 *    y emite el evento `disputa.resuelta`.
 */
@Injectable()
export class AdminDisputasService implements AdminDisputasUseCasePort {
  constructor(
    @Inject(ADMIN_DISPUTAS_REPOSITORY_PORT)
    private readonly repositorio: AdminDisputasRepositoryPort,
    @Optional()
    @Inject(ADMIN_EVENTS_PORT)
    private readonly eventos?: AdminEventsPort,
  ) {}

  async crearDisputa(comando: CrearDisputaCommand): Promise<DisputaResumen> {
    const motivo = comando.motivo.trim();
    if (!motivo) {
      throw new BadRequestException('El motivo de la disputa es obligatorio');
    }

    const tanda = await this.repositorio.obtenerTanda(comando.idTanda);
    if (!tanda) {
      throw new NotFoundException('Tanda no encontrada');
    }

    const esOrganizador = tanda.idAdmin === comando.idReporter;
    const esAdminGlobal = comando.rolReporter === 'admin_global';
    const esParticipante =
      esOrganizador || esAdminGlobal
        ? true
        : await this.repositorio.esParticipanteDeTanda(comando.idTanda, comando.idReporter);

    if (!esParticipante) {
      throw new ForbiddenException('Solo los miembros de la tanda pueden abrir una disputa');
    }

    if (comando.idPayment !== undefined) {
      const pertenece = await this.repositorio.pagoPerteneceATanda(
        comando.idPayment,
        comando.idTanda,
      );
      if (!pertenece) {
        throw new BadRequestException('El pago indicado no pertenece a esta tanda');
      }
    }

    if (comando.idPayout !== undefined) {
      const pertenece = await this.repositorio.entregaPerteneceATanda(
        comando.idPayout,
        comando.idTanda,
      );
      if (!pertenece) {
        throw new BadRequestException('La entrega indicada no pertenece a esta tanda');
      }
    }

    return this.repositorio.crearDisputa({
      idTanda: comando.idTanda,
      idReporter: comando.idReporter,
      reason: motivo,
      idPayment: comando.idPayment ?? null,
      idPayout: comando.idPayout ?? null,
    });
  }

  async listarDisputas(filtro?: ListarDisputasFiltro): Promise<DisputaResumen[]> {
    return this.repositorio.listarDisputas(filtro);
  }

  async obtenerDisputa(idDispute: number): Promise<DisputaDetalle> {
    const disputa = await this.repositorio.obtenerPorId(idDispute);
    if (!disputa) {
      throw new NotFoundException('Disputa no encontrada');
    }
    return disputa;
  }

  async resolverDisputa(comando: ResolverDisputaCommand): Promise<DisputaResumen> {
    const notas = comando.notas.trim();
    if (!notas) {
      throw new BadRequestException('Las notas de resolución son obligatorias');
    }

    const disputa = await this.repositorio.obtenerPorId(comando.idDispute);
    if (!disputa) {
      throw new NotFoundException('Disputa no encontrada');
    }

    if (disputa.status === 'RESUELTA' || disputa.status === 'DESCARTADA') {
      throw new ConflictException('La disputa ya fue resuelta');
    }

    const auditDescription = `Disputa resuelta con acción "${comando.accion}": ${notas}`;

    const resuelta = await this.repositorio.resolverConAuditoria({
      idDispute: disputa.idDispute,
      idTanda: disputa.idTanda,
      idPayment: disputa.idPayment,
      idPayout: disputa.idPayout,
      idAdminGlobal: comando.idAdminGlobal,
      accion: comando.accion,
      notas,
      actionType: ACCION_DISPUTA_RESUELTA,
      auditDescription,
    });

    await this.eventos?.publicarDisputaResuelta({
      idDispute: disputa.idDispute,
      idTanda: disputa.idTanda,
      nombreTanda: disputa.nombreTanda,
      emailReporter: disputa.emailReporter,
      nombreReporter: disputa.nombreReporter,
      accion: comando.accion,
      notas,
    });

    return resuelta;
  }
}
