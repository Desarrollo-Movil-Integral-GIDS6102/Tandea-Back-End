import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';
import { Writable } from 'stream';
import { CloudinaryAdapter } from '../src/pagos/infrastructure/adapters/out/storage/cloudinary.adapter';

describe('Adaptador de Infraestructura: CloudinaryAdapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'tandea_cloud';
    process.env.CLOUDINARY_API_KEY = '1234567890';
    process.env.CLOUDINARY_API_SECRET = 'secret_cloudinary_key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('debe configurar las credenciales de Cloudinary desde variables de entorno', () => {
    const configSpy = vi.spyOn(cloudinary, 'config');
    new CloudinaryAdapter();

    expect(configSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: 'tandea_cloud',
        api_key: '1234567890',
        api_secret: 'secret_cloudinary_key',
        secure: true,
      }),
    );
  });

  it('debe subir el comprobante a la carpeta "comprobantes/" con compresión previa y devolver secure_url', async () => {
    let capturedOptions: any = null;

    vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(
      (options: any, callback: any) => {
        capturedOptions = options;

        const mockWritable = new Writable({
          write(_chunk, _encoding, next) {
            next();
          },
          final(next) {
            callback(null, {
              secure_url:
                'https://res.cloudinary.com/tandea_cloud/image/upload/v12345/comprobantes/spei_123.webp',
              public_id: 'comprobantes/spei_123',
            });
            next();
          },
        });

        return mockWritable as any;
      },
    );

    const adapter = new CloudinaryAdapter();
    const fakeBuffer = Buffer.from('contenido_binario_comprobante');

    const resultUrl = await adapter.subir(fakeBuffer);

    // Criterio 1: Un comprobante subido se guarda en la carpeta comprobantes/
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions.folder).toBe('comprobantes');

    // Criterio 2: Compresión y optimización previa de peso
    expect(capturedOptions.transformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quality: 'auto:good' }),
        expect.objectContaining({ fetch_format: 'auto' }),
      ]),
    );

    // Criterio 3: Devuelve su URL
    expect(resultUrl).toBe(
      'https://res.cloudinary.com/tandea_cloud/image/upload/v12345/comprobantes/spei_123.webp',
    );
  });

  it('debe rechazar si el buffer está vacío', async () => {
    const adapter = new CloudinaryAdapter();
    const emptyBuffer = Buffer.alloc(0);

    await expect(adapter.subir(emptyBuffer)).rejects.toThrow(
      'El buffer del comprobante no puede estar vacío',
    );
  });

  it('debe manejar errores devueltos por la API de Cloudinary', async () => {
    vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(
      (_options: any, callback: any) => {
        const mockWritable = new Writable({
          write(_chunk, _encoding, next) {
            next();
          },
          final(next) {
            callback(new Error('Formato de imagen no soportado o corrupto'), null);
            next();
          },
        });

        return mockWritable as any;
      },
    );

    const adapter = new CloudinaryAdapter();
    const fakeBuffer = Buffer.from('archivo_invalido');

    await expect(adapter.subir(fakeBuffer)).rejects.toThrow(
      /Error al subir el comprobante a Cloudinary/,
    );
  });
});
