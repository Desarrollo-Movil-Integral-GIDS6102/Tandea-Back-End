import { Injectable, Logger } from '@nestjs/common';
import {
  OcrServicePort,
  ResultadoOcr,
} from '../../../../domain/ports/out/ocr-service.port';

const VISION_URL = 'https://vision.googleapis.com/v1';
const TIMEOUT_MS = 10_000;
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Montos como "$1,000.00", "1000.00" o "$ 600". Se descartan números sueltos
 * sin "$", sin decimales y sin separador de miles (fechas, folios, cuentas).
 */
const REGEX_MONTO = /\$?\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?(?!\d)/g;

/**
 * Adaptador Secundario (Driven / Outbound Adapter): OcrGoogleVisionAdapter
 *
 * Lee el texto del comprobante con la API REST de Google Cloud Vision
 * (TEXT_DETECTION para imágenes, DOCUMENT_TEXT_DETECTION para PDF) y extrae
 * el monto más cercano al esperado. La decisión de si "coincide" es del dominio.
 *
 * Credencial: variable de entorno GOOGLE_VISION_KEY (API key de Google Cloud).
 * Sin la variable, no llama a Google y reporta "monto no detectado":
 * el pago queda con ocr_verified = false para revisión manual.
 */
@Injectable()
export class OcrGoogleVisionAdapter implements OcrServicePort {
  private readonly logger = new Logger(OcrGoogleVisionAdapter.name);
  private readonly apiKey = process.env.GOOGLE_VISION_KEY;

  constructor() {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_VISION_KEY no configurada: el OCR queda desactivado');
    }
  }

  async verificarMonto(imagen: Buffer, montoEsperado: number): Promise<ResultadoOcr> {
    if (!this.apiKey) {
      return { montoDetectado: null };
    }

    const texto = await this.leerTexto(imagen);
    return { montoDetectado: elegirMonto(texto, montoEsperado) };
  }

  private async leerTexto(archivo: Buffer): Promise<string> {
    const content = archivo.toString('base64');
    const esPdf = FIRMA_PDF.every((byte, i) => archivo[i] === byte);

    const [endpoint, request] = esPdf
      ? [
          'files:annotate',
          {
            inputConfig: { content, mimeType: 'application/pdf' },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            pages: [1],
          },
        ]
      : ['images:annotate', { image: { content }, features: [{ type: 'TEXT_DETECTION' }] }];

    const res = await fetch(`${VISION_URL}/${endpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [request] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Google Vision respondió ${res.status}`);
    }

    const body = (await res.json()) as VisionRespuesta;
    // files:annotate anida una respuesta por página
    const respuesta = esPdf ? body.responses?.[0]?.responses?.[0] : body.responses?.[0];
    if (respuesta?.error) {
      throw new Error(`Google Vision: ${respuesta.error.message}`);
    }
    return respuesta?.fullTextAnnotation?.text ?? '';
  }
}

/**
 * Busca montos en el texto y devuelve el más cercano al esperado,
 * o null si el texto no contiene ningún monto.
 */
export function elegirMonto(texto: string, montoEsperado: number): number | null {
  const candidatos = (texto.match(REGEX_MONTO) ?? [])
    .filter((m) => /[$.,]/.test(m))
    .map((m) => Number(m.replace(/[$,\s]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (candidatos.length === 0) {
    return null;
  }
  return candidatos.reduce((mejor, n) =>
    Math.abs(n - montoEsperado) < Math.abs(mejor - montoEsperado) ? n : mejor,
  );
}

interface VisionAnotacion {
  fullTextAnnotation?: { text?: string };
  error?: { message?: string };
  responses?: VisionAnotacion[];
}

interface VisionRespuesta {
  responses?: VisionAnotacion[];
}
