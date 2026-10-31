import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import {
  DomainError,
  PlanTandaInvalidoError,
} from '../../../../../domain/errors/tanda.errors';
import {
  NumeroInexistenteError,
  NumeroYaTomadoError,
  NumeroMuertoNoElegibleError,
  NumeroFueraDeRangoError,
} from '../../../../../domain/errors/numero.errors';

/**
 * Filtro de Excepciones para Errores de Dominio de Tandas.
 *
 * En Arquitectura Hexagonal:
 * - El Dominio lanza excepciones de negocio puras (subclases de DomainError).
 * - Este adaptador primario intercepta dichos errores y responde con el código HTTP correspondiente:
 *   - NumeroInexistenteError → 404 Not Found
 *   - NumeroYaTomadoError → 409 Conflict
 *   - NumeroMuertoNoElegibleError, NumeroFueraDeRangoError, PlanTandaInvalidoError → 400 Bad Request
 *   - Otros DomainError → 422 Unprocessable Entity
 */
@Catch(DomainError)
export class TandaDomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.UNPROCESSABLE_ENTITY;
    let error = 'Unprocessable Entity';

    if (exception instanceof NumeroInexistenteError) {
      status = HttpStatus.NOT_FOUND;
      error = 'Not Found';
    } else if (exception instanceof NumeroYaTomadoError) {
      status = HttpStatus.CONFLICT;
      error = 'Conflict';
    } else if (
      exception instanceof NumeroMuertoNoElegibleError ||
      exception instanceof NumeroFueraDeRangoError ||
      exception instanceof PlanTandaInvalidoError
    ) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
    }

    response.status(status).send({
      statusCode: status,
      error,
      message: exception.message,
    });
  }
}
