import { Pago, MetodoPago } from '../../../../../domain/entities/Pago';
import type {
  PaymentRow,
  NewPaymentRow,
} from '../../../../../../database/tandea.schema';
import type { PagoResponseDto } from '../../../../../application/dtos/pago.dto';

/**
 * Mappers del Adaptador de Persistencia y Presentación.
 *
 * En Arquitectura Hexagonal:
 *  - Aisla completamente las tablas y tipos de Drizzle de la entidad pura de Dominio.
 */

/**
 * La tabla `payment` no guarda el método: se deriva de los montos.
 */
function derivarMetodo(transferAmount: number, cashAmount: number): MetodoPago {
  if (transferAmount > 0 && cashAmount > 0) return 'hibrido';
  if (transferAmount > 0) return 'transferencia';
  return 'efectivo';
}

/**
 * Convierte una fila de `payment` (y la URL de su evidencia, si existe) a la entidad de Dominio.
 */
export function toDomain(row: PaymentRow, evidenceUrl: string | null = null): Pago {
  const transferAmount = parseFloat(row.transferAmount ?? '0');
  const cashAmount = parseFloat(row.cashAmount ?? '0');

  return Pago.reconstitute({
    idPayment: row.idPayment,
    idNumber: row.idNumber,
    transferAmount,
    cashAmount,
    totalAmount: parseFloat(row.totalAmount),
    metodoPago: derivarMetodo(transferAmount, cashAmount),
    status: row.status,
    confirmedByParticipant: row.confirmedByParticipant,
    confirmedByAdmin: row.confirmedByAdmin,
    rejectionReason: row.rejectionReason ?? null,
    evidenceUrl,
    ocrDetectedAmount:
      row.ocrDetectedAmount != null ? parseFloat(row.ocrDetectedAmount) : null,
    ocrVerified: row.ocrVerified,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Convierte una entidad de Dominio al formato de inserción de Drizzle (`payment`).
 * Los montos se guardan como texto con 2 decimales para el tipo NUMERIC(12,2).
 */
export function toPersistence(pago: Pago): NewPaymentRow {
  const p = pago.toPrimitives();
  return {
    idPayment: p.idPayment,
    idNumber: p.idNumber,
    transferAmount: p.transferAmount.toFixed(2),
    cashAmount: p.cashAmount.toFixed(2),
    totalAmount: p.totalAmount.toFixed(2),
    ocrDetectedAmount:
      p.ocrDetectedAmount != null ? p.ocrDetectedAmount.toFixed(2) : null,
    ocrVerified: p.ocrVerified ?? false,
    confirmedByParticipant: p.confirmedByParticipant,
    confirmedByAdmin: p.confirmedByAdmin,
    rejectionReason: p.rejectionReason ?? null,
    status: p.status,
    rejectionReason: p.rejectionReason ?? null,
  };
}

/**
 * Convierte una entidad de Dominio al DTO de respuesta para clientes HTTP.
 */
export function toResponseDto(pago: Pago): PagoResponseDto {
  const p = pago.toPrimitives();
  return {
    idPayment: p.idPayment ?? 0,
    idNumber: p.idNumber,
    metodoPago: p.metodoPago,
    transferAmount: p.transferAmount,
    cashAmount: p.cashAmount,
    totalAmount: p.totalAmount,
    status: p.status,
    confirmedByParticipant: p.confirmedByParticipant,
    confirmedByAdmin: p.confirmedByAdmin,
    rejectionReason: p.rejectionReason ?? null,
    ocrVerified: p.ocrVerified ?? false,
    ocrDetectedAmount: p.ocrDetectedAmount ?? null,
    evidenceUrl: p.evidenceUrl ?? null,
    rejectionReason: p.rejectionReason ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
