import { BadRequestException } from '@nestjs/common';
import type {
  MultipartOptions,
  UploadedMultipartFile,
} from '@nestjs/platform-fastify/multipart';
import type { ComprobanteArchivo } from '../../../../../domain/ports/in/pago-use-cases.port';

/** Tamaño máximo del comprobante: 10 MB. */
export const COMPROBANTE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Tipos permitidos y su firma de bytes ("magic numbers"), para no confiar
 * solo en el Content-Type que manda el cliente.
 */
const FIRMAS_PERMITIDAS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
};

const MENSAJE_TIPO_INVALIDO = 'El comprobante debe ser un archivo JPG, PNG o PDF';

/**
 * Opciones de `FileInterceptor('file', ...)` para el comprobante de pago.
 * Si el archivo excede `fileSize`, el interceptor responde 413 Payload Too Large.
 */
export const comprobanteMultipartOptions: MultipartOptions = {
  limits: { fileSize: COMPROBANTE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype in FIRMAS_PERMITIDAS) {
      callback(null, true);
    } else {
      callback(new BadRequestException(MENSAJE_TIPO_INVALIDO), false);
    }
  },
};

/**
 * Valida el contenido del comprobante recibido y lo convierte al formato del caso de uso.
 */
export function validarComprobante(file: UploadedMultipartFile): ComprobanteArchivo {
  const buffer = file.buffer;
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException('El comprobante está vacío');
  }

  const firma = FIRMAS_PERMITIDAS[file.mimetype];
  const coincide = firma?.every((byte, i) => buffer[i] === byte) ?? false;
  if (!coincide) {
    throw new BadRequestException(MENSAJE_TIPO_INVALIDO);
  }

  return {
    buffer,
    mimetype: file.mimetype,
    nombreOriginal: file.originalname,
  };
}
