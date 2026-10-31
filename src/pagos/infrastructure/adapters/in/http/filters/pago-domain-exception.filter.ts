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
  MontoHibridoInvalidoError,
  NumeroNoEncontradoError,
  TandaNoEncontradaError,
  NumeroAjenoError,
  UsuarioNoAutorizadoError,
  PagoDuplicadoError,
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

    if (
      exception instanceof PagoNotFoundError ||
      exception instanceof NumeroNoEncontradoError ||
      exception instanceof TandaNoEncontradaError
    ) {
      status = HttpStatus.NOT_FOUND;
      error = 'Not Found';
    } else if (
      exception instanceof NumeroAjenoError ||
      exception instanceof UsuarioNoAutorizadoError
    ) {
      status = HttpStatus.FORBIDDEN;
      error = 'Forbidden';
    } else if (exception instanceof PagoDuplicadoError) {
      status = HttpStatus.CONFLICT;
      error = 'Conflict';
    } else if (exception instanceof MontoHibridoInvalidoError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      error = 'Unprocessable Entity';
    }

    response.status(status).send({
      statusCode: status,
      error,
      message: exception.message,
    });
  }
}
