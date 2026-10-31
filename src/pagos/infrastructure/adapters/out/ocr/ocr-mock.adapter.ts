import { Injectable } from '@nestjs/common';
import {
  OcrServicePort,
  ResultadoOcr,
} from '../../../../domain/ports/out/ocr-service.port';

/**
 * Adaptador temporal de OCR: no lee nada y reporta "monto no detectado".
 * El pago queda con `ocr_verified = false` y el organizador lo revisa manualmente.
 */
@Injectable()
export class OcrMockAdapter implements OcrServicePort {
  async verificarMonto(): Promise<ResultadoOcr> {
    return { montoDetectado: null, coincide: false };
  }
}
