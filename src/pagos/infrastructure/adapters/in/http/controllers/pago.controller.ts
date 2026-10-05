import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseFilters,
  Inject,
} from '@nestjs/common';

import {
  zPagoCreate,
  zPagoResponse,
  type CreatePagoDto,
  type PagoResponseDto,
} from '../../../../../application/dtos/pago.dto';
import { toResponseDto } from '../../../out/database/mappers/pago.mapper';
import {
  PAGO_SERVICE_PORT,
  type PagoUseCasesPort,
} from '../../../../../domain/ports/in/pago-use-cases.port';
import { PagoDomainExceptionFilter } from '../filters/pago-domain-exception.filter';

/**
 * Adaptador Primario (Driving / Inbound Adapter): PagoController
 *
 * Responsabilidades:
 *  1. Recibir y responder peticiones sobre HTTP.
 *  2. Validar el payload de entrada con Zod.
 *  3. Invocar al puerto de entrada (casos de uso).
 *  4. Mapear la entidad de dominio a DTO de respuesta y validarlo.
 *  5. Capturar y traducir errores mediante PagoDomainExceptionFilter.
 */
@Controller('pagos')
@UseFilters(PagoDomainExceptionFilter)
export class PagoController {
  constructor(
    @Inject(PAGO_SERVICE_PORT)
    private readonly pagoService: PagoUseCasesPort,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // POST /pagos — Crear un nuevo pago
  // ─────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crearPago(@Body() body: unknown): Promise<PagoResponseDto> {
    const dto: CreatePagoDto = zPagoCreate.parse(body);

    const pago = await this.pagoService.crearPago({
      tandaId: dto.tandaId,
      participanteId: dto.participanteId,
      numeroPago: dto.numeroPago,
      monto: dto.monto,
      montoEfectivo: dto.montoEfectivo,
      montoTransferencia: dto.montoTransferencia,
      metodoPago: dto.metodoPago,
      comprobanteUrl: dto.comprobanteUrl,
      fechaPago: dto.fechaPago,
    });

    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /pagos/:id — Obtener un pago por ID
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  async obtenerPago(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PagoResponseDto> {
    const pago = await this.pagoService.obtenerPago(id);
    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/confirmar-organizador
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/confirmar-organizador')
  async confirmarOrganizador(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PagoResponseDto> {
    const pago = await this.pagoService.confirmarOrganizador(id);
    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/confirmar-receptor
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/confirmar-receptor')
  async confirmarReceptor(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PagoResponseDto> {
    const pago = await this.pagoService.confirmarReceptor(id);
    return zPagoResponse.parse(toResponseDto(pago));
  }
}
