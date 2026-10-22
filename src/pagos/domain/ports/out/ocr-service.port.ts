/**
 * Resultado de leer el monto de un comprobante.
 */
export interface ResultadoOcr {
  /** Monto leído del comprobante, o null si no se pudo detectar. */
  montoDetectado: number | null;
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
 * - La decisión de si el monto "coincide" (tolerancia) es del dominio (`Pago.registrarResultadoOcr`).
 */
export interface OcrServicePort {
  /**
   * Lee el monto del comprobante.
   *
   * @param imagen Contenido binario del comprobante (JPG, PNG o PDF).
   * @param montoEsperado Monto que se espera encontrar (ayuda al proveedor a elegir entre candidatos).
   */
  verificarMonto(imagen: Buffer, montoEsperado: number): Promise<ResultadoOcr>;
}
