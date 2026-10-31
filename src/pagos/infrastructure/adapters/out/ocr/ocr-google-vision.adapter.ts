import { Injectable, Logger, Optional } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import {
  OcrServicePort,
  ResultadoOcr,
} from '../../../../domain/ports/out/ocr-service.port';

interface CandidatoMonto {
  monto: number;
  prioridad: number; // Mayor prioridad para coincidencias contextuales (con $, palabras clave)
}

/**
 * Adaptador Secundario (Driven / Outbound Adapter): OcrGoogleVisionAdapter
 *
 * Implementa `OcrServicePort` integrando Google Cloud Vision API mediante `textDetection`.
 * Extrae montos de comprobantes bancarios, normaliza a centavos para evitar errores
 * de coma flotante y compara contra el monto esperado con tolerancia de ±1.00 MXN.
 */
@Injectable()
export class OcrGoogleVisionAdapter implements OcrServicePort {
  private readonly logger = new Logger(OcrGoogleVisionAdapter.name);
  private client: ImageAnnotatorClient | null = null;

  constructor(@Optional() visionClient?: ImageAnnotatorClient) {
    if (visionClient) {
      this.client = visionClient;
    }
  }

  /**
   * Obtiene o inicializa el cliente de Google Cloud Vision de forma segura.
   */
  private getClient(): ImageAnnotatorClient {
    if (this.client) {
      return this.client;
    }

    // Configuración segura mediante variables de entorno
    if (process.env.GOOGLE_VISION_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS);
        this.client = new ImageAnnotatorClient({ credentials });
        return this.client;
      } catch (e: unknown) {
        this.logger.warn(
          `Error al parsear GOOGLE_VISION_CREDENTIALS: ${e instanceof Error ? e.message : String(e)}. Usando configuración predeterminada.`,
        );
      }
    }

    // Usa las credenciales estándar (GOOGLE_APPLICATION_CREDENTIALS o entorno GCP)
    this.client = new ImageAnnotatorClient();
    return this.client;
  }

  /**
   * Lee el comprobante mediante Google Cloud Vision y verifica el monto contra el esperado.
   */
  async verificarMonto(
    imagen: Buffer,
    montoEsperado: number,
  ): Promise<ResultadoOcr> {
    if (!imagen || imagen.length === 0) {
      return { montoDetectado: null, coincide: false };
    }

    try {
      const client = this.getClient();
      const [result] = await client.textDetection({
        image: { content: imagen },
      });

      const fullText =
        result?.fullTextAnnotation?.text ??
        result?.textAnnotations?.[0]?.description ??
        '';

      if (!fullText || !fullText.trim()) {
        return { montoDetectado: null, coincide: false };
      }

      return this.analizarTexto(fullText, montoEsperado);
    } catch (error: unknown) {
      this.logger.error(
        `Error al invocar Google Cloud Vision API: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { montoDetectado: null, coincide: false };
    }
  }

  /**
   * Extrae importes monetarios del texto detectado y compara contra el monto esperado.
   */
  analizarTexto(texto: string, montoEsperado: number): ResultadoOcr {
    const candidatos = this.extraerCandidatos(texto);

    if (candidatos.length === 0) {
      return { montoDetectado: null, coincide: false };
    }

    // Tolerancia de ±1.00 MXN convertida a centavos enteros (±100 centavos)
    const centavosEsperados = Math.round(montoEsperado * 100);

    const coincidencias = candidatos.filter((c) => {
      const centavosCandidato = Math.round(c.monto * 100);
      return Math.abs(centavosCandidato - centavosEsperados) <= 100;
    });

    if (coincidencias.length > 0) {
      // Ordenar: primero por prioridad (etiqueta contextual), luego por cercanía exacta al esperado
      coincidencias.sort((a, b) => {
        const diffA = Math.abs(Math.round(a.monto * 100) - centavosEsperados);
        const diffB = Math.abs(Math.round(b.monto * 100) - centavosEsperados);
        if (a.prioridad !== b.prioridad) return b.prioridad - a.prioridad;
        return diffA - diffB;
      });

      return {
        montoDetectado: coincidencias[0].monto,
        coincide: true,
      };
    }

    // Si ninguno coincide, seleccionar el candidato más probable (mayor prioridad o más cercano)
    candidatos.sort((a, b) => {
      if (a.prioridad !== b.prioridad) return b.prioridad - a.prioridad;
      const diffA = Math.abs(Math.round(a.monto * 100) - centavosEsperados);
      const diffB = Math.abs(Math.round(b.monto * 100) - centavosEsperados);
      return diffA - diffB;
    });

    return {
      montoDetectado: candidatos[0].monto,
      coincide: false,
    };
  }

  /**
   * Extrae números del texto evitando fechas, folios, horas y cuentas bancarias.
   */
  private extraerCandidatos(texto: string): CandidatoMonto[] {
    const candidatos: CandidatoMonto[] = [];
    const montosVistos = new Set<number>();

    const agregar = (montoStr: string, prioridad: number) => {
      const num = this.normalizarMonto(montoStr);
      if (num !== null && !montosVistos.has(num)) {
        montosVistos.add(num);
        candidatos.push({ monto: num, prioridad });
      }
    };

    // 1. Patrón contextual: palabras clave bancarias precediendo al importe
    // Ejemplos: "Monto: $1,250.00", "Importe transferido: 600.00", "Total $ 1000", "Cantidad: 500.50"
    const regexContexto =
      /(?:monto|importe|cantidad|total|pago|transferido|recibido|spei)[\s\w.:]*?(?:\$|MXN)?\s*(\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;

    let match: RegExpExecArray | null;
    while ((match = regexContexto.exec(texto)) !== null) {
      if (match[1]) {
        agregar(match[1], 10);
      }
    }

    // 2. Patrón con símbolo de moneda explícito: "$ 1,500.00", "$1500.00", "$500", "MXN 1,200.50"
    const regexMoneda =
      /(?:\$|MXN)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;

    while ((match = regexMoneda.exec(texto)) !== null) {
      if (match[1]) {
        agregar(match[1], 8);
      }
    }

    // 3. Patrón numérico con separador de miles y decimales: "1,500.00" o con miles sin decimales: "1,500"
    const regexMiles = /\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b/g;

    while ((match = regexMiles.exec(texto)) !== null) {
      if (match[1]) {
        agregar(match[1], 5);
      }
    }

    // 4. Patrón numérico estándar con decimales: "500.00", "1250.50"
    const regexDecimales = /\b(\d+\.\d{2})\b/g;

    while ((match = regexDecimales.exec(texto)) !== null) {
      if (match[1]) {
        // Verificar que no sea parte de una fecha o una hora
        const index = match.index;
        const charAntes = texto[index - 1] ?? ' ';
        const charDespues = texto[index + match[0].length] ?? ' ';
        if (!['/', '-', ':'].includes(charAntes) && !['/', '-', ':'].includes(charDespues)) {
          agregar(match[1], 3);
        }
      }
    }

    // 5. Números enteros aislados de 2 a 6 dígitos (posibles importes sin decimales: "500", "1000")
    // Solo si no es fecha ni teléfono ni folio
    const regexEnteros = /\b(\d{2,6})\b/g;
    while ((match = regexEnteros.exec(texto)) !== null) {
      const index = match.index;
      const charAntes = texto[index - 1] ?? ' ';
      const charDespues = texto[index + match[0].length] ?? ' ';
      const valor = parseInt(match[1], 10);

      // Descartar años probables (2020-2035) y componentes de fechas/horas
      const esAnio = valor >= 2020 && valor <= 2035;
      const esFechaOHora = ['/', '-', ':'].includes(charAntes) || ['/', '-', ':'].includes(charDespues);

      if (!esAnio && !esFechaOHora) {
        agregar(match[1], 1);
      }
    }

    return candidatos;
  }

  /**
   * Limpia y normaliza un importe en texto a un número seguro en centavos.
   */
  private normalizarMonto(montoStr: string): number | null {
    if (!montoStr) return null;

    // Remover espacios, signo $, texto MXN y comas de miles
    const limpio = montoStr
      .replace(/\$/g, '')
      .replace(/mxn/gi, '')
      .replace(/\s/g, '')
      .replace(/,/g, '');

    const valor = parseFloat(limpio);
    if (isNaN(valor) || valor <= 0 || !isFinite(valor)) {
      return null;
    }

    // Descartar números exageradamente largos (folios, números de cuenta, CLABEs)
    if (valor > 10000000) {
      return null;
    }

    // Normalizar a centavos enteros para evitar errores de precisión de punto flotante
    const centavos = Math.round(valor * 100);
    return centavos / 100;
  }
}
