import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { FastifyReply } from 'fastify';

/**
 * ZodValidationExceptionFilter — Captura ZodError lanzados en los Controllers
 * y los transforma en una respuesta HTTP 422 estructurada.
 *
 * Esto permite que el Controller simplemente llame a zSchema.parse(body)
 * sin manejar el try/catch — el filtro global lo captura automáticamente.
 */
@Catch(ZodError)
export class ZodValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: 'Unprocessable Entity',
      message: 'Error de validación en los datos enviados',
      details: exception.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    });
  }
}
