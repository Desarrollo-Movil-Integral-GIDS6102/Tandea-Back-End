import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  idUser: number;
  email: string;
  role: string;
}

/** En producción JWT_SECRET es obligatorio: sin él cualquiera podría forjar tokens. */
export function obtenerJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no está definido; el servidor no puede iniciar en producción');
  }
  return 'tandea_secret_key_sprint1';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: obtenerJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Token inválido o malformado');
    }

    return {
      idUser: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
