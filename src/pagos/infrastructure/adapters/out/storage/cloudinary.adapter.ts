import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import {
  StoragePort,
  SubirArchivoOpciones,
} from '../../../../domain/ports/out/storage.port';

/**
 * Adaptador Secundario (Driven / Outbound Adapter): CloudinaryAdapter
 *
 * Implementa el puerto StoragePort utilizando la API oficial de Cloudinary.
 *
 * Cumplimiento de Criterios de Aceptación:
 * 1. Un comprobante subido se guarda en la carpeta "comprobantes/" por defecto.
 * 2. Aplica compresión y optimización previa de peso (quality: 'auto:good', fetch_format: 'auto').
 * 3. Las credenciales se obtienen exclusivamente de variables de entorno:
 *    - CLOUDINARY_CLOUD_NAME
 *    - CLOUDINARY_API_KEY
 *    - CLOUDINARY_API_SECRET
 */
@Injectable()
export class CloudinaryAdapter implements StoragePort {
  constructor() {
    this.configurarCliente();
  }

  private configurarCliente(): void {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      // Advertencia en desarrollo si faltan las credenciales
      // En producción debe estar configurado en el archivo .env
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  /**
   * Sube el buffer binario a Cloudinary en la carpeta "comprobantes/" aplicando compresión.
   *
   * @param buffer Contenido binario del comprobante.
   * @param opciones Opciones adicionales (nombre de archivo, subcarpeta opcional).
   * @returns La URL pública segura (secure_url) retornada por Cloudinary.
   */
  async subir(buffer: Buffer, opciones?: SubirArchivoOpciones): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new Error('El buffer del comprobante no puede estar vacío');
    }

    // Sin credenciales Cloudinary falla con "Must supply api_key" y el cliente recibe un 500 genérico
    const { cloud_name, api_key, api_secret } = cloudinary.config();
    if (!cloud_name || !api_key || !api_secret) {
      throw new ServiceUnavailableException(
        'El servidor no tiene configurado el almacenamiento de fotos (CLOUDINARY_*)',
      );
    }

    // Carpeta obligatoria por requerimiento: "comprobantes"
    const carpeta = opciones?.carpeta ?? 'comprobantes';

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: carpeta,
          public_id: opciones?.nombreArchivo,
          resource_type: 'auto',
          // Compresión y optimización previa de calidad y peso
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
            { width: 2048, crop: 'limit' },
          ],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(
              new Error(
                `Error al subir el comprobante a Cloudinary: ${error?.message ?? 'Respuesta inválida'}`,
              ),
            );
          }
          resolve(result.secure_url);
        },
      );

      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
    });
  }
}
