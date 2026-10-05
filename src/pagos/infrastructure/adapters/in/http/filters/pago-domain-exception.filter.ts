import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import {
  DomainError,
  PagoNotFoundError,
} from '../../../../../domain/errors/pago.errors';

/**
 * Filtro de Excepciones para Errores de Dominio.
 *
 * En Arquitectura Hexagonal:
 *  - El Dominio lanza excepciones de negocio puras (DomainError).
 *  - Este Adaptador HTTP intercepta los errores de dominio y los traduce
 *    a la respuesta HTTP con el código de estado correspondiente.
 */
@Catch(DomainError)
export class PagoDomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.UNPROCESSABLE_ENTITY;
    let error = 'Unprocessable Entity';

    if (exception instanceof PagoNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      error = 'Not Found';
    }

    response.status(status).send({
      statusCode: status,
      error,
      message: exception.message,
    });
  }
}
