import {
  RegisterDto,
  RegisterResponseDto,
} from '../../../application/dtos/register.dto';

export const REGISTER_USE_CASE_PORT = Symbol('REGISTER_USE_CASE_PORT');

export interface RegisterUseCasePort {
  register(dto: RegisterDto): Promise<RegisterResponseDto>;
}
