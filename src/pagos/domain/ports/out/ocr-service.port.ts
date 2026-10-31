/**
 * Resultado de leer el monto de un comprobante.
 */
export interface ResultadoOcr {
  /** Monto leído del comprobante, o null si no se pudo detectar. */
  montoDetectado: number | null;
  /** Indica si el monto detectado coincide con el esperado dentro de la tolerancia (±1.00 MXN). */
  coincide: boolean;
}

/**
 * Token de Inyección de Dependencias para el puerto de OCR.
 */
export const OCR_SERVICE_PORT = Symbol('OCR_SERVICE_PORT');

/**
 * Puerto Secundario / Salida (Driven Port): OcrServicePort
 *
 * En Arquitectura Hexagonal:
 * - Define el contrato para leer el monto de un comprobante sin depender del proveedor
 *   (Google Vision, Tesseract, etc.).
 * - Compara el monto detectado contra el esperado considerando la tolerancia definida.
 */
export interface OcrServicePort {
  /**
   * Lee el monto del comprobante y verifica si coincide con el esperado.
   *
   * @param imagen Contenido binario del comprobante (JPG, PNG o PDF).
   * @param montoEsperado Monto que se espera encontrar (ayuda al proveedor a elegir entre candidatos).
   */
  verificarMonto(imagen: Buffer, montoEsperado: number): Promise<ResultadoOcr>;
}
