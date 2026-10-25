import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OcrGoogleVisionAdapter,
  elegirMonto,
} from '../src/pagos/infrastructure/adapters/out/ocr/ocr-google-vision.adapter';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from('%PDF-1.4 comprobante');

function respuestaVision(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe('elegirMonto', () => {
  it('lee "$1,000.00" como 1000', () => {
    expect(elegirMonto('SPEI enviado\nImporte: $1,000.00 MXN', 1000)).toBe(1000);
  });

  it('elige el monto más cercano al esperado entre varios', () => {
    const texto = 'Saldo $12,345.67\nImporte $600.00\nComisión $5.80';
    expect(elegirMonto(texto, 600)).toBe(600);
  });

  it('ignora fechas, horas y folios sin formato de dinero', () => {
    expect(elegirMonto('Fecha 2026-10-05 16:20 Folio 98765', 600)).toBeNull();
  });

  it('lee montos sin separador de miles con decimales', () => {
    expect(elegirMonto('Total 10000.00', 10000)).toBe(10000);
  });
});

describe('OcrGoogleVisionAdapter', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    process.env.GOOGLE_VISION_KEY = 'clave-de-prueba';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_VISION_KEY;
  });

  it('sin GOOGLE_VISION_KEY no llama a Google y devuelve monto nulo', async () => {
    delete process.env.GOOGLE_VISION_KEY;
    const adapter = new OcrGoogleVisionAdapter();

    await expect(adapter.verificarMonto(PNG, 1000)).resolves.toEqual({ montoDetectado: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('imagen: usa images:annotate y devuelve el monto detectado', async () => {
    fetchMock.mockResolvedValue(
      respuestaVision({ responses: [{ fullTextAnnotation: { text: 'Monto $1,000.00' } }] }),
    );

    const resultado = await new OcrGoogleVisionAdapter().verificarMonto(PNG, 1000);

    expect(resultado).toEqual({ montoDetectado: 1000 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/images:annotate?key=clave-de-prueba');
    expect(JSON.parse(init.body).requests[0].image.content).toBe(PNG.toString('base64'));
  });

  it('PDF: usa files:annotate y lee la primera página', async () => {
    fetchMock.mockResolvedValue(
      respuestaVision({
        responses: [{ responses: [{ fullTextAnnotation: { text: 'Importe $600.00' } }] }],
      }),
    );

    const resultado = await new OcrGoogleVisionAdapter().verificarMonto(PDF, 600);

    expect(resultado).toEqual({ montoDetectado: 600 });
    expect(fetchMock.mock.calls[0][0]).toContain('/files:annotate?key=');
  });

  it('lanza error si Google responde con error (el servicio lo deja para revisión manual)', async () => {
    fetchMock.mockResolvedValue(respuestaVision({}, false, 403));

    await expect(new OcrGoogleVisionAdapter().verificarMonto(PNG, 1000)).rejects.toThrow('403');
  });
});
