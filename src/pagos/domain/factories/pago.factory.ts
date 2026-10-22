import { Pago, MetodoPago } from '../entities/Pago';
import { MontoHibridoInvalidoError, ReglaNegocioPagoError } from '../errors/pago.errors';
import { esMontoMonetarioValido, sumarCentavosExactos, toCentavos } from '../utils/moneda.util';

export interface CrearPagoFactoryDto {
  idPayment?: number;
  id?: string;
  idNumber: number;
  metodoPago: MetodoPago | string;
  totalAmount?: number;
  monto?: number;
  cuota?: number;
  transferAmount?: number;
  montoTransferencia?: number;
  cashAmount?: number;
  montoEfectivo?: number;
  evidenceUrl?: string | null;
  fileUrl?: string | null;
  comprobanteUrl?: string | null;
  confirmedByParticipant?: boolean;
  confirmedByAdmin?: boolean;
  status?: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';
  ocrDetectedAmount?: number | null;
  ocrVerified?: boolean;
  fechaPago?: Date;
  tandaId?: string;
  participanteId?: string;
  numeroPago?: number;
}

export interface MontosPago {
  metodoPago: MetodoPago;
  transferAmount: number;
  cashAmount: number;
  totalAmount: number;
}

/**
 * Fábrica de Dominio: PagoFactory
 *
 * En Arquitectura Hexagonal y DDD:
 *  - Encapsula la lógica de instanciación y validación financiera de pagos.
 *  - Construye el objeto Pago asegurando las invariantes según el método de pago:
 *    * Efectivo: 100% efectivo, 0 transferencia, comprobante opcional.
 *    * Transferencia: 100% transferencia, 0 efectivo, comprobante obligatorio.
 *    * Híbrido: efectivo > 0, transferencia > 0, suma == cuota, comprobante obligatorio.
 *  - Todas las comparaciones de montos se hacen en centavos enteros (nunca con floats).
 *  - NO contiene dependencias de frameworks (@nestjs, etc.).
 */
export class PagoFactory {
  /**
   * Crea y valida una instancia de Pago según el método de pago especificado.
   */
  public static crear(dto: CrearPagoFactoryDto): Pago {
    const { metodoPago, transferAmount, cashAmount, totalAmount } =
      PagoFactory.validarMontos(dto);

    // Comprobante: obligatorio cuando hay transferencia, opcional en efectivo
    const rawEvidence = dto.evidenceUrl ?? dto.fileUrl ?? dto.comprobanteUrl ?? null;
    const cleanEvidence =
      typeof rawEvidence === 'string' && rawEvidence.trim().length > 0
        ? rawEvidence.trim()
        : null;

    if (metodoPago === 'transferencia' && !cleanEvidence) {
      throw new ReglaNegocioPagoError(
        'El pago por transferencia requiere un comprobante digital obligatorio (URL de comprobante)',
      );
    }
    if (metodoPago === 'hibrido' && !cleanEvidence) {
      throw new ReglaNegocioPagoError(
        'El pago híbrido requiere un comprobante digital obligatorio para respaldar el monto de transferencia',
      );
    }

    // Instanciar la entidad Pago con el estado inicial correspondiente
    const confirmedByParticipant = dto.confirmedByParticipant ?? false;
    const confirmedByAdmin = dto.confirmedByAdmin ?? false;

    const status: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' =
      dto.status ?? (confirmedByParticipant && confirmedByAdmin ? 'CONFIRMADO' : 'PENDIENTE');

    return Pago.create({
      idPayment: dto.idPayment,
      id: dto.id,
      idNumber: dto.idNumber,
      transferAmount,
      cashAmount,
      totalAmount,
      metodoPago,
      status,
      confirmedByParticipant,
      confirmedByAdmin,
      evidenceUrl: cleanEvidence,
      ocrDetectedAmount: dto.ocrDetectedAmount ?? null,
      ocrVerified: dto.ocrVerified ?? false,
      fechaPago: dto.fechaPago,
      tandaId: dto.tandaId,
      participanteId: dto.participanteId,
      numeroPago: dto.numeroPago,
    });
  }

  /**
   * Valida idNumber, método y montos (en centavos) sin exigir comprobante.
   * Permite rechazar montos inválidos antes de subir cualquier archivo.
   */
  public static validarMontos(dto: CrearPagoFactoryDto): MontosPago {
    // 1. Validar identificador de número/turno
    if (
      dto.idNumber === undefined ||
      dto.idNumber === null ||
      typeof dto.idNumber !== 'number' ||
      !Number.isInteger(dto.idNumber) ||
      dto.idNumber <= 0
    ) {
      throw new ReglaNegocioPagoError(
        'El identificador del número (idNumber) debe ser un entero positivo válido',
      );
    }

    // 2. Validar método de pago
    const metodoNormalizado = (dto.metodoPago ?? '').toLowerCase().trim() as MetodoPago;
    if (!['efectivo', 'transferencia', 'hibrido'].includes(metodoNormalizado)) {
      throw new ReglaNegocioPagoError(
        `Método de pago "${dto.metodoPago}" no es válido. Opciones permitidas: efectivo, transferencia, hibrido`,
      );
    }

    // 3. Normalizar parámetros de entrada
    const rawTotal = dto.totalAmount ?? dto.monto ?? dto.cuota;
    const rawTransfer = dto.transferAmount ?? dto.montoTransferencia;
    const rawCash = dto.cashAmount ?? dto.montoEfectivo;

    PagoFactory.validarMonto(rawTotal, 'La cuota total');
    PagoFactory.validarMonto(rawTransfer, 'El monto de transferencia');
    PagoFactory.validarMonto(rawCash, 'El monto en efectivo');

    let finalTransfer = 0;
    let finalCash = 0;
    let finalTotal = 0;

    // 4. Aplicar invariantes según el método
    switch (metodoNormalizado) {
      case 'efectivo': {
        if (rawTransfer !== undefined && rawTransfer > 0) {
          throw new ReglaNegocioPagoError(
            'El método de pago en efectivo no permite montos por transferencia',
          );
        }

        const effectiveAmount = rawCash !== undefined ? rawCash : rawTotal;
        if (effectiveAmount === undefined || effectiveAmount <= 0) {
          throw new ReglaNegocioPagoError(
            'El monto en efectivo debe ser un número positivo mayor a cero',
          );
        }

        if (rawTotal !== undefined && rawCash !== undefined) {
          if (toCentavos(rawCash) !== toCentavos(rawTotal)) {
            throw new ReglaNegocioPagoError(
              `El monto en efectivo (${rawCash}) debe coincidir con la cuota total (${rawTotal})`,
            );
          }
        }

        finalCash = Number(effectiveAmount.toFixed(2));
        finalTransfer = 0;
        finalTotal = finalCash;
        break;
      }

      case 'transferencia': {
        if (rawCash !== undefined && rawCash > 0) {
          throw new ReglaNegocioPagoError(
            'El método de pago por transferencia no permite montos en efectivo',
          );
        }

        const transferAmount = rawTransfer !== undefined ? rawTransfer : rawTotal;
        if (transferAmount === undefined || transferAmount <= 0) {
          throw new ReglaNegocioPagoError(
            'El monto por transferencia debe ser un número positivo mayor a cero',
          );
        }

        if (rawTotal !== undefined && rawTransfer !== undefined) {
          if (toCentavos(rawTransfer) !== toCentavos(rawTotal)) {
            throw new ReglaNegocioPagoError(
              `El monto de transferencia (${rawTransfer}) debe coincidir con la cuota total (${rawTotal})`,
            );
          }
        }

        finalTransfer = Number(transferAmount.toFixed(2));
        finalCash = 0;
        finalTotal = finalTransfer;
        break;
      }

      case 'hibrido': {
        if (rawTransfer === undefined || rawTransfer <= 0) {
          throw new ReglaNegocioPagoError(
            'El método híbrido requiere un monto de transferencia mayor a cero',
          );
        }

        if (rawCash === undefined || rawCash <= 0) {
          throw new ReglaNegocioPagoError(
            'El método híbrido requiere un monto en efectivo mayor a cero',
          );
        }

        const sum = (toCentavos(rawTransfer) + toCentavos(rawCash)) / 100;
        if (rawTotal !== undefined) {
          if (!sumarCentavosExactos(rawCash, rawTransfer, rawTotal)) {
            throw new MontoHibridoInvalidoError(rawCash, rawTransfer, sum, rawTotal);
          }
          finalTotal = Number(rawTotal.toFixed(2));
        } else {
          finalTotal = sum;
        }

        finalTransfer = Number(rawTransfer.toFixed(2));
        finalCash = Number(rawCash.toFixed(2));
        break;
      }
    }

    return {
      metodoPago: metodoNormalizado,
      transferAmount: finalTransfer,
      cashAmount: finalCash,
      totalAmount: finalTotal,
    };
  }

  /**
   * Rechaza montos no finitos, negativos o con fracciones de centavo.
   */
  private static validarMonto(valor: number | undefined, campo: string): void {
    if (valor !== undefined && !esMontoMonetarioValido(valor)) {
      throw new ReglaNegocioPagoError(
        `${campo} debe ser un número finito no negativo con máximo 2 decimales`,
      );
    }
  }
}
