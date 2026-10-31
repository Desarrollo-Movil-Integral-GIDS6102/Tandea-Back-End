import { describe, it, expect, vi } from 'vitest';
import { OcrGoogleVisionAdapter } from '../src/pagos/infrastructure/adapters/out/ocr/ocr-google-vision.adapter';
import type { ImageAnnotatorClient } from '@google-cloud/vision';

describe('OcrGoogleVisionAdapter (AP-04)', () => {
  const crearMockClient = (textoDetectado: string | null, error?: Error): ImageAnnotatorClient => {
    return {
      textDetection: vi.fn(async () => {
        if (error) {
          throw error;
        }
        if (textoDetectado === null) {
          return [{}];
        }
        return [
          {
            fullTextAnnotation: { text: textoDetectado },
            textAnnotations: [{ description: textoDetectado }],
          },
        ];
      }),
    } as unknown as ImageAnnotatorClient;
  };

  const fakeBuffer = Buffer.from('fake-receipt-image-content');

  // ── Monto detectado igual al esperado ────────────────────────────────────

  it('detecta monto idéntico al esperado con símbolo $ y decimales', async () => {
    const texto = `
      BBVA México
      Comprobante de Transferencia SPEI
      Fecha: 27/10/2026 14:30
      Folio: 987654321
      Monto: $1,000.00 MXN
      Cuenta Destino: **** 5678
    `;
    const mockClient = crearMockClient(texto);
    const adapter = new OcrGoogleVisionAdapter(mockClient);

    const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

    expect(resultado).toEqual({
      montoDetectado: 1000,
      coincide: true,
    });
    expect(mockClient.textDetection).toHaveBeenCalledWith({
      image: { content: fakeBuffer },
    });
  });

  // ── Tolerancia de ±1.00 MXN ──────────────────────────────────────────────

  describe('tolerancia de ±1.00 MXN', () => {
    it('acepta monto con +1.00 peso de diferencia (dentro de tolerancia)', async () => {
      const texto = 'Transferencia exitosa. Total pagado: $1,001.00';
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: 1001,
        coincide: true,
      });
    });

    it('acepta monto con -1.00 peso de diferencia (dentro de tolerancia)', async () => {
      const texto = 'Transferencia exitosa. Total pagado: $999.00';
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: 999,
        coincide: true,
      });
    });

    it('acepta variación de centavos (+0.50 MXN dentro de tolerancia)', async () => {
      const texto = 'Importe: $1,000.50';
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: 1000.5,
        coincide: true,
      });
    });

    it('rechaza monto con +1.01 pesos de diferencia (fuera de tolerancia)', async () => {
      const texto = 'Importe recibido: $1,001.01';
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: 1001.01,
        coincide: false,
      });
    });

    it('rechaza monto con -1.01 pesos de diferencia (fuera de tolerancia)', async () => {
      const texto = 'Importe recibido: $998.99';
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: 998.99,
        coincide: false,
      });
    });

    it('rechaza importe discrepante sustancial (ej. $500 vs $1,000 esperado)', async () => {
      const texto = 'Comprobante SPEI. Monto transferido: $500.00';
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: 500,
        coincide: false,
      });
    });
  });

  // ── Formatos con separadores de miles y decimales ─────────────────────────

  describe('formatos numéricos y expresiones monetarias', () => {
    it.each([
      ['con comas y decimales ($1,250.50)', 'Monto: $1,250.50', 1250.5, 1250.5],
      ['sin comas con decimales ($1250.50)', 'Importe: $1250.50', 1250.5, 1250.5],
      ['con comas sin decimales ($1,250)', 'Cantidad: $1,250 MXN', 1250, 1250],
      ['espacios entre símbolo y número ($ 1,500.00)', 'Total: $ 1,500.00', 1500, 1500],
      ['sin símbolo de pesos con comas (1,500.00)', 'Transferido: 1,500.00', 1500, 1500],
      ['sin símbolo ni comas con decimales (1500.00)', 'Monto 1500.00', 1500, 1500],
    ])('extrae correctamente formato %s', async (_nombre, texto, esperado, detectado) => {
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));
      const res = await adapter.verificarMonto(fakeBuffer, esperado);
      expect(res.montoDetectado).toBe(detectado);
      expect(res.coincide).toBe(true);
    });

    it('no confunde fechas, folios ni horas con el importe transferido', async () => {
      const texto = `
        Santander México
        Fecha de operación: 2026-10-27
        Hora: 14:30:52
        Número de folio: 202610270102030405
        Cuenta ordenante: 1234567890
        Referencia: 789456123
        Importe de la transferencia: $750.00 MXN
      `;
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 750);

      expect(resultado).toEqual({
        montoDetectado: 750,
        coincide: true,
      });
    });
  });

  // ── Pagos híbridos: comparación del monto de transferencia ────────────────

  describe('pagos híbridos', () => {
    it('compara contra el montoTransferencia (600) y no contra el monto total (1000)', async () => {
      const texto = `
        SPEI BANORTE
        Transferencia realizada por $600.00 MXN
        Concepto: Tanda turno 3 parte transferencia
      `;
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      // En un pago híbrido de $1000 ($400 efectivo + $600 transferencia),
      // el monto esperado enviado al OCR es 600
      const resultado = await adapter.verificarMonto(fakeBuffer, 600);

      expect(resultado).toEqual({
        montoDetectado: 600,
        coincide: true,
      });
    });
  });

  // ── Imagen ilegible o sin monto detectable ────────────────────────────────

  describe('comprobantes ilegibles o sin monto detectable', () => {
    it('retorna montoDetectado: null y coincide: false ante imagen sin texto', async () => {
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(''));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: null,
        coincide: false,
      });
    });

    it('retorna montoDetectado: null y coincide: false ante texto sin importes monetarios legibles', async () => {
      const texto = `
        Hola esto es una foto borrosa
        Sin números ni datos bancarios reconocibles
      `;
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(texto));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: null,
        coincide: false,
      });
    });

    it('retorna montoDetectado: null ante buffer vacío', async () => {
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(''));

      const resultado = await adapter.verificarMonto(Buffer.alloc(0), 1000);

      expect(resultado).toEqual({
        montoDetectado: null,
        coincide: false,
      });
    });
  });

  // ── Error del proveedor externo (Google Vision) ───────────────────────────

  describe('manejo de errores del proveedor externo', () => {
    it('maneja error de conexión o API caída sin propagar excepción al cliente', async () => {
      const errorProveedor = new Error('503 Service Unavailable: Google Cloud Vision API');
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(null, errorProveedor));

      const resultado = await adapter.verificarMonto(fakeBuffer, 1000);

      expect(resultado).toEqual({
        montoDetectado: null,
        coincide: false,
      });
    });

    it('maneja error de autenticación del proveedor', async () => {
      const errorAuth = new Error('401 Unauthorized: Invalid credentials');
      const adapter = new OcrGoogleVisionAdapter(crearMockClient(null, errorAuth));

      const resultado = await adapter.verificarMonto(fakeBuffer, 500);

      expect(resultado).toEqual({
        montoDetectado: null,
        coincide: false,
      });
    });
  });
});
