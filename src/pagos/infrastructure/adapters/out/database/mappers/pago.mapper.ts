import { Pago, MetodoPago, EstadoPago } from '../../../../../domain/entities/pago.entity';
import type { PagoRow, NewPagoRow } from '../schema/pago.schema';
import type { PagoResponseDto } from '../../../../../application/dtos/pago.dto';

/**
 * Mappers del Adaptador de Persistencia y Presentación.
 *
 * En Arquitectura Hexagonal:
 *  - Aisla completamente las tablas y tipos de Drizzle de la entidad pura de Dominio.
 */

/**
 * Convierte una fila de la base de datos (PagoRow) a la entidad rica de Dominio (Pago).
 */
export function toDomain(row: PagoRow): Pago {
  return Pago.reconstitute({
    id: row.id,
    tandaId: row.tandaId,
    participanteId: row.participanteId,
    numeroPago: row.numeroPago,
    monto: parseFloat(row.monto),
    montoEfectivo: parseFloat(row.montoEfectivo ?? '0'),
    montoTransferencia: parseFloat(row.montoTransferencia ?? '0'),
    metodoPago: row.metodoPago as MetodoPago,
    estado: row.estado as EstadoPago,
    comprobanteUrl: row.comprobanteUrl ?? null,
    montoOcrValidado:
      row.montoOcrValidado != null ? parseFloat(row.montoOcrValidado) : null,
    ocrAprobado: row.ocrAprobado ?? null,
    confirmadoOrganizadorEn: row.confirmadoOrganizadorEn ?? null,
    confirmadoReceptorEn: row.confirmadoReceptorEn ?? null,
    fechaPago: row.fechaPago,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Convierte una entidad de Dominio (Pago) al formato de inserción de Drizzle (NewPagoRow).
 */
export function toPersistence(pago: Pago): NewPagoRow {
  const p = pago.toPrimitives();
  return {
    id: p.id,
    tandaId: p.tandaId,
    participanteId: p.participanteId,
    numeroPago: p.numeroPago,
    monto: String(p.monto),
    montoEfectivo: String(p.montoEfectivo),
    montoTransferencia: String(p.montoTransferencia),
    metodoPago: p.metodoPago,
    estado: p.estado,
    comprobanteUrl: p.comprobanteUrl,
    montoOcrValidado:
      p.montoOcrValidado != null ? String(p.montoOcrValidado) : null,
    ocrAprobado: p.ocrAprobado,
    confirmadoOrganizadorEn: p.confirmadoOrganizadorEn,
    confirmadoReceptorEn: p.confirmadoReceptorEn,
    fechaPago: p.fechaPago,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * Convierte una entidad de Dominio (Pago) al DTO de respuesta para clientes HTTP.
 */
export function toResponseDto(pago: Pago): PagoResponseDto {
  const p = pago.toPrimitives();
  return {
    id: p.id,
    tandaId: p.tandaId,
    participanteId: p.participanteId,
    numeroPago: p.numeroPago,
    monto: p.monto,
    montoEfectivo: p.montoEfectivo,
    montoTransferencia: p.montoTransferencia,
    metodoPago: p.metodoPago,
    estado: p.estado,
    comprobanteUrl: p.comprobanteUrl,
    montoOcrValidado: p.montoOcrValidado,
    ocrAprobado: p.ocrAprobado,
    confirmadoOrganizadorEn: p.confirmadoOrganizadorEn,
    confirmadoReceptorEn: p.confirmadoReceptorEn,
    fechaPago: p.fechaPago,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
