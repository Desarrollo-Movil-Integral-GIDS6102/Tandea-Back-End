import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';

// Controllers
import { AuthController } from './infrastructure/adapters/in/http/controllers/auth.controller';

// Services & Ports
import { AuthService } from './application/services/auth.service';
import { LOGIN_USE_CASE_PORT } from './domain/ports/in/login-use-case.port';
import { AUTH_USER_REPOSITORY_PORT } from './domain/ports/out/auth-user-repository.port';

// Repositories (Drizzle)
import { DrizzleAuthUserRepository } from './infrastructure/adapters/out/database/drizzle-auth-user.repository';

// Strategies & Guards
import { LocalStrategy } from './infrastructure/adapters/in/http/strategies/local.strategy';
import { JwtStrategy } from './infrastructure/adapters/in/http/strategies/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { RolesGuard } from './infrastructure/adapters/in/http/guards/roles.guard';
import { LocalAuthGuard } from './infrastructure/adapters/in/http/guards/local-auth.guard';
import { TandaMemberGuard } from './infrastructure/adapters/in/http/guards/tanda-member.guard';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'tandea_secret_key_sprint1',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Vinculación de puertos y adaptadores (Hexagonal)
    {
      provide: AUTH_USER_REPOSITORY_PORT,
      useClass: DrizzleAuthUserRepository,
    },
    {
      provide: LOGIN_USE_CASE_PORT,
      useClass: AuthService,
    },
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    LocalAuthGuard,
    TandaMemberGuard,
  ],
  exports: [
    AuthService,
    LOGIN_USE_CASE_PORT,
    JwtAuthGuard,
    RolesGuard,
    TandaMemberGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
