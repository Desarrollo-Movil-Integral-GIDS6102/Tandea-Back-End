import { Injectable } from '@nestjs/common';
import {
  OcrServicePort,
  ResultadoOcr,
} from '../../../../domain/ports/out/ocr-service.port';

/**
 * Adaptador temporal de OCR: no lee nada y reporta "monto no detectado".
 * El pago queda con `ocr_verified = false` y el organizador lo revisa manualmente.
 *
 * TODO([INT-PAGO] Implementar OcrServicePort y OcrGoogleVisionAdapter (AP-04)):
 * reemplazar este mock por OcrGoogleVisionAdapter en PagoModule.
 */
@Injectable()
export class OcrMockAdapter implements OcrServicePort {
  async verificarMonto(): Promise<ResultadoOcr> {
    return { montoDetectado: null };
  }
}
