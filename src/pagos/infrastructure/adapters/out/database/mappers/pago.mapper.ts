import { Pago, MetodoPago, EstadoPago } from '../../../../../domain/entities/Pago';
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
    idNumber: row.numeroPago,
    tandaId: row.tandaId,
    participanteId: row.participanteId,
    numeroPago: row.numeroPago,
    transferAmount: parseFloat(row.montoTransferencia ?? '0'),
    cashAmount: parseFloat(row.montoEfectivo ?? '0'),
    totalAmount: parseFloat(row.monto),
    metodoPago: row.metodoPago as MetodoPago,
    status:
      row.estado?.toUpperCase() === 'CONFIRMADO'
        ? 'CONFIRMADO'
        : row.estado?.toUpperCase() === 'RECHAZADO'
          ? 'RECHAZADO'
          : 'PENDIENTE',
    confirmedByParticipant: row.confirmadoOrganizadorEn != null,
    confirmedByAdmin: row.confirmadoOrganizadorEn != null,
    evidenceUrl: row.comprobanteUrl ?? null,
    ocrDetectedAmount:
      row.montoOcrValidado != null ? parseFloat(row.montoOcrValidado) : null,
    ocrVerified: row.ocrAprobado ?? false,
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
    tandaId: p.tandaId ?? '00000000-0000-0000-0000-000000000000',
    participanteId: p.participanteId ?? '00000000-0000-0000-0000-000000000000',
    numeroPago: p.numeroPago ?? p.idNumber,
    monto: String(p.totalAmount),
    montoEfectivo: String(p.cashAmount),
    montoTransferencia: String(p.transferAmount),
    metodoPago: p.metodoPago,
    estado: p.status.toLowerCase(),
    comprobanteUrl: p.evidenceUrl ?? null,
    montoOcrValidado:
      p.ocrDetectedAmount != null ? String(p.ocrDetectedAmount) : null,
    ocrAprobado: p.ocrVerified ?? null,
    confirmadoOrganizadorEn: p.confirmadoOrganizadorEn ?? null,
    confirmadoReceptorEn: p.confirmadoReceptorEn ?? null,
    fechaPago: p.fechaPago ?? p.createdAt,
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
    id: p.id ?? '',
    tandaId: p.tandaId ?? '',
    participanteId: p.participanteId ?? '',
    numeroPago: p.numeroPago ?? p.idNumber,
    monto: p.totalAmount,
    montoEfectivo: p.cashAmount,
    montoTransferencia: p.transferAmount,
    metodoPago: p.metodoPago,
    estado: p.status.toLowerCase() as any,
    comprobanteUrl: p.evidenceUrl ?? null,
    montoOcrValidado: p.ocrDetectedAmount ?? null,
    ocrAprobado: p.ocrVerified ?? null,
    confirmadoOrganizadorEn: p.confirmadoOrganizadorEn ?? null,
    confirmadoReceptorEn: p.confirmadoReceptorEn ?? null,
    fechaPago: p.fechaPago ?? p.createdAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
