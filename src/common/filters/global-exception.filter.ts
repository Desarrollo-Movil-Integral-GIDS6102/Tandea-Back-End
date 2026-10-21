import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/**
 * GlobalExceptionFilter — Filtro global centralizado para capturar y estandarizar
 * todas las excepciones de la API de Tandea siguiendo las mejores prácticas REST:
 *
 *  - ZodError → 422 Unprocessable Entity (con lista detallada de campos faltantes o inválidos)
 *  - HttpException → Preserva status y mensaje específico de NestJS
 *  - Errores de PostgreSQL / Drizzle (FK, Unique, Not Null) → 400 Bad Request o 409 Conflict
 *  - Errores de validación de Dominio → 400 Bad Request
 *  - Errores no controlados → 500 Internal Server Error con logging detallado
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const path = request.url;
    const timestamp = new Date().toISOString();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ZodError (Validaciones de esquema de DTOs en entrada)
    // ─────────────────────────────────────────────────────────────────────────
    if (exception instanceof ZodError) {
      const details = exception.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        message: err.message,
        code: err.code,
      }));

      response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'Unprocessable Entity',
        message: 'Error de validación: uno o más campos son inválidos o faltan en la petición.',
        details,
        timestamp,
        path,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. HttpException estándar de NestJS (401, 403, 404, 409, etc.)
    // ─────────────────────────────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      let message: any = exception.message;
      let error = exception.name;

      if (typeof res === 'object' && res !== null) {
        message = (res as any).message ?? message;
        error = (res as any).error ?? error;
      }

      response.status(status).send({
        statusCode: status,
        error,
        message,
        timestamp,
        path,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Errores de Base de Datos (PostgreSQL / Drizzle ORM)
    // ─────────────────────────────────────────────────────────────────────────
    const dbError = (exception as any)?.cause || (exception as any)?.driverError || exception;
    const dbCode = dbError?.code;

    if (dbCode) {
      // 23503: Violación de Clave Foránea (Foreign Key)
      if (dbCode === '23503') {
        const detail = dbError.detail || '';
        const match = /Key \((.+?)\)=\((.+?)\) is not present in table "(.+?)"/.exec(detail);

        let customMessage = 'El recurso relacionado no existe en el sistema.';
        let field = 'unknown';

        if (match) {
          field = match[1];
          const value = match[2];
          const table = match[3];
          customMessage = `El valor '${value}' para el campo '${field}' no existe en la tabla de referencia '${table}'.`;
        }

        this.logger.warn(`[DB Foreign Key Error] ${customMessage} en ${path}`);

        response.status(HttpStatus.BAD_REQUEST).send({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: customMessage,
          field,
          code: 'FOREIGN_KEY_NOT_FOUND',
          timestamp,
          path,
        });
        return;
      }

      // 23505: Violación de Restricción Única (Duplicate Key)
      if (dbCode === '23505') {
        const detail = dbError.detail || '';
        const match = /Key \((.+?)\)=\((.+?)\) already exists/.exec(detail);

        let customMessage = 'Ya existe un registro con los datos proporcionados.';
        let field = 'unknown';

        if (match) {
          field = match[1];
          const value = match[2];
          customMessage = `El valor '${value}' para el campo '${field}' ya se encuentra registrado y debe ser único.`;
        }

        this.logger.warn(`[DB Unique Constraint Error] ${customMessage} en ${path}`);

        response.status(HttpStatus.CONFLICT).send({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: customMessage,
          field,
          code: 'DUPLICATE_ENTRY',
          timestamp,
          path,
        });
        return;
      }

      // 23502: Violación de No Nulo (Not Null Violation)
      if (dbCode === '23502') {
        const column = dbError.column || 'desconocido';
        const customMessage = `El campo '${column}' es obligatorio y no puede ser nulo en la base de datos.`;

        response.status(HttpStatus.BAD_REQUEST).send({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: customMessage,
          field: column,
          code: 'NOT_NULL_VIOLATION',
          timestamp,
          path,
        });
        return;
      }

      // 22P02: Tipo de dato inválido en PostgreSQL (ej. string en integer)
      if (dbCode === '22P02') {
        response.status(HttpStatus.BAD_REQUEST).send({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Uno de los parámetros proporcionados tiene un tipo de dato o formato incompatible con la base de datos.',
          code: 'INVALID_DATA_TYPE',
          timestamp,
          path,
        });
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Errores de Validación de Entidades de Dominio
    // ─────────────────────────────────────────────────────────────────────────
    if (exception instanceof Error) {
      const msg = exception.message;
      const isDomainRule =
        msg.includes('Una tanda debe tener') ||
        msg.includes('El monto de contribución') ||
        msg.includes('Los días de gracia') ||
        msg.includes('Debe haber al menos') ||
        msg.includes('El nombre de la tanda') ||
        msg.includes('La cuota debe ser');

      if (isDomainRule) {
        response.status(HttpStatus.BAD_REQUEST).send({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: msg,
          code: 'DOMAIN_RULE_VIOLATION',
          timestamp,
          path,
        });
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Errores no controlados (500 Internal Server Error)
    // ─────────────────────────────────────────────────────────────────────────
    const errMessage = exception instanceof Error ? exception.message : 'Error interno no especificado';
    const errStack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(`[Unhandled Exception 500] ${errMessage} en ${path}`, errStack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Ocurrió un error interno en el servidor.',
      detail: process.env.NODE_ENV !== 'production' ? errMessage : undefined,
      timestamp,
      path,
    });
  }
}
