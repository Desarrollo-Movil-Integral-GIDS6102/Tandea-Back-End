import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import {
  FileInterceptor,
  type UploadedMultipartFile,
} from '@nestjs/platform-fastify/multipart';

import {
  zRegistrarPago,
  zRechazarPago,
  zPagoResponse,
  type PagoResponseDto,
} from '../../../../../application/dtos/pago.dto';
import { toResponseDto } from '../../../out/database/mappers/pago.mapper';
import {
  PAGO_SERVICE_PORT,
  type PagoUseCasesPort,
} from '../../../../../domain/ports/in/pago-use-cases.port';
import { PagoDomainExceptionFilter } from '../filters/pago-domain-exception.filter';
import {
  comprobanteMultipartOptions,
  validarComprobante,
} from '../multipart/comprobante.file';
import { JwtAuthGuard } from '../../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { TandaMemberGuard } from '../../../../../../auth/infrastructure/adapters/in/http/guards/tanda-member.guard';
import { CurrentUser } from '../../../../../../auth/infrastructure/adapters/in/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../../auth/infrastructure/adapters/in/http/strategies/jwt.strategy';

/**
 * Adaptador Primario (Driving / Inbound Adapter): PagoController
 *
 * Responsabilidades:
 *  1. Recibir y responder peticiones sobre HTTP.
 *  2. Validar el payload de entrada con Zod y el comprobante (tipo, firma y tamaño).
 *  3. Proteger endpoints de administración de tanda con TandaMemberGuard.
 *  4. Invocar al puerto de entrada (casos de uso).
 *  5. Mapear la entidad de dominio a DTO de respuesta y validarlo.
 *  6. Capturar y traducir errores mediante PagoDomainExceptionFilter.
 */
@Controller('pagos')
@UseGuards(JwtAuthGuard)
@UseFilters(PagoDomainExceptionFilter)
export class PagoController {
  constructor(
    @Inject(PAGO_SERVICE_PORT)
    private readonly pagoService: PagoUseCasesPort,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // POST /pagos — Registrar el pago de un turno (multipart/form-data, AP-03)
  // ─────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', comprobanteMultipartOptions))
  async registrarPago(
    @Body() body: unknown,
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PagoResponseDto> {
    const dto = zRegistrarPago.parse(body ?? {});
    const comprobante = file ? validarComprobante(file) : null;

    const pago = await this.pagoService.registrar({
      idUser: user.idUser,
      idNumber: dto.idNumber,
      metodoPago: dto.metodoPago,
      transferAmount: dto.transferAmount,
      cashAmount: dto.cashAmount,
      comprobante,
    });

    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /pagos/:id — Obtener un pago por ID
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  async obtenerPago(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PagoResponseDto> {
    const pago = await this.pagoService.obtenerPago(id);
    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/confirmar — Confirmación del Organizador (AP-05)
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/confirmar')
  @UseGuards(TandaMemberGuard)
  async confirmar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PagoResponseDto> {
    const pago = await this.pagoService.confirmar(id, user);
    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/rechazar — Rechazo del Organizador (AP-05)
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/rechazar')
  @UseGuards(TandaMemberGuard)
  async rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PagoResponseDto> {
    const dto = zRechazarPago.parse(body ?? {});
    const pago = await this.pagoService.rechazar(id, dto.motivo, user);
    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/confirmar-organizador (Alias retrocompatible)
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/confirmar-organizador')
  @UseGuards(TandaMemberGuard)
  async confirmarOrganizador(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PagoResponseDto> {
    const pago = await this.pagoService.confirmarOrganizador(id, user);
    return zPagoResponse.parse(toResponseDto(pago));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /pagos/:id/confirmar-receptor
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/confirmar-receptor')
  async confirmarReceptor(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PagoResponseDto> {
    const pago = await this.pagoService.confirmarReceptor(id);
    return zPagoResponse.parse(toResponseDto(pago));
  }
}
