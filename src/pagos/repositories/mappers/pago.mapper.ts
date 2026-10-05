import type { PagoRow } from '../schema/pago.schema';
import type { PagoModel, MetodoPago, EstadoPago } from '../../models/pago.model';
import type { PagoResponseDto } from '../../contracts/pago.contract';

// ─────────────────────────────────────────────────────────────────────────────
// Row → Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * toPagoModel — Convierte una fila cruda de PostgreSQL (PagoRow) al modelo
 * de dominio (PagoModel).
 *
 * Responsabilidades:
 *  - Convertir snake_case → camelCase
 *  - Parsear strings de numeric() a number
 *  - Castear varchar de enums al tipo correcto del dominio
 *  - Garantizar que NINGUNA fila cruda escape del repositorio
 */
export function toPagoModel(row: PagoRow): PagoModel {
  return {
    id: row.id,
    tandaId: row.tandaId,
    participanteId: row.participanteId,
    numeroPago: row.numeroPago,

    // Drizzle devuelve numeric como string — convertimos a number aquí
    monto: parseFloat(row.monto),
    montoEfectivo: parseFloat(row.montoEfectivo ?? '0'),
    montoTransferencia: parseFloat(row.montoTransferencia ?? '0'),

    // Castear varchar al enum del dominio
    metodoPago: row.metodoPago as MetodoPago,
    estado: row.estado as EstadoPago,

    comprobanteUrl: row.comprobanteUrl ?? null,
    montoOcrValidado: row.montoOcrValidado != null
      ? parseFloat(row.montoOcrValidado)
      : null,
    ocrAprobado: row.ocrAprobado ?? null,

    confirmadoOrganizadorEn: row.confirmadoOrganizadorEn ?? null,
    confirmadoReceptorEn: row.confirmadoReceptorEn ?? null,

    fechaPago: row.fechaPago,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Model → ResponseDTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * toPagoResponse — Convierte un PagoModel (dominio) a PagoResponseDto
 * para ser validado con zPagoResponse.parse() en el controller.
 *
 * Aquí se pueden ocultar campos internos o transformar datos
 * antes de exponer al cliente (ej. formatear fechas, redondear montos).
 */
export function toPagoResponse(model: PagoModel): PagoResponseDto {
  return {
    id: model.id,
    tandaId: model.tandaId,
    participanteId: model.participanteId,
    numeroPago: model.numeroPago,
    monto: model.monto,
    montoEfectivo: model.montoEfectivo,
    montoTransferencia: model.montoTransferencia,
    metodoPago: model.metodoPago,
    estado: model.estado,
    comprobanteUrl: model.comprobanteUrl,
    montoOcrValidado: model.montoOcrValidado,
    ocrAprobado: model.ocrAprobado,
    confirmadoOrganizadorEn: model.confirmadoOrganizadorEn,
    confirmadoReceptorEn: model.confirmadoReceptorEn,
    fechaPago: model.fechaPago,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}
