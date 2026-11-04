# 🔔 Módulo de Notificaciones — Esquema de Base de Datos e Índices

Documentación técnica correspondiente a la tarjeta **SP-3-[BD-NOTIF]**, desarrollada bajo **Arquitectura Hexagonal** sobre NestJS, Fastify, Drizzle ORM y PostgreSQL.

> [!IMPORTANT]
> **Alcance de la tarjeta**: Esta especificación cubre únicamente la definición de esquema de persistencia (columna `fcm_token` en la tabla `user` y validación del índice en `notification`). **NO incluye endpoints REST, adaptadores de Firebase ni servicios de envío de notificaciones**, los cuales serán abordados en tarjetas subsecuentes del módulo de notificaciones.

---

## 📋 Resumen del Cambio

| Elemento | Nombre en BD (PostgreSQL) | Nombre en Schema Drizzle | Tipo / Definición | Nullable |
| :--- | :--- | :--- | :--- | :---: |
| **Tabla Usuario** | `user` | `userTable` | `pgTable('user', ...)` | — |
| **Columna Token FCM** | `fcm_token` | `fcmToken` | `text('fcm_token')` | **SÍ** |
| **Tabla Notificación** | `notification` | `notificationTable` | `pgTable('notification', ...)` | — |
| **Índice Notificaciones** | `notification_user_read_idx` | `notification_user_read_idx` | `(id_user, is_read)` | — |

---

## 🎯 Propósito de los Elementos

### 1. Columna `fcm_token` en `user`
- **¿Para qué sirve?**: Almacena el token de registro generado por **Firebase Cloud Messaging (FCM)** en el dispositivo móvil del usuario para el despacho de notificaciones push (recordatorios de pago, confirmaciones de turno, alertas de tandas).
- **¿Por qué es nullable?**:
  - El usuario puede rechazar el permiso de notificaciones push en el dispositivo móvil.
  - Al registrarse o iniciar sesión por primera vez, el token puede no estar disponible de inmediato.
  - En entornos de prueba o accesos web, puede no existir token asociado.
- **Seguridad y Privacidad**:
  - **No exposición HTTP**: `fcm_token` **no** se expone en ninguna respuesta HTTP (`/auth/login`, `/auth/register`, `/auth/perfil`, `/auth/profile`).
  - **Mappers protegidos**: Los mappers y consultas de repositorio (`DrizzleAuthUserRepository`) seleccionan de forma explícita únicamente los campos permitidos del dominio.
  - **Cero logs**: Está prohibido imprimir o registrar tokens FCM en bitácoras o logs del servidor.

### 2. Índice Compuesto `notification_user_read_idx` en `notification`
- **¿Para qué sirve?**: Optimiza la consulta más crítica del centro de notificaciones: obtener las notificaciones pendientes de lectura de un usuario ordenadas cronológicamente:
  ```sql
  SELECT * FROM "notification"
  WHERE "id_user" = $1 AND "is_read" = false
  ORDER BY "created_at" DESC;
  ```
- **Orden de Columnas**: `(id_user, is_read)`:
  - Primer nivel: Filtra las filas pertenecientes al usuario autenticado.
  - Segundo nivel: Filtra o discrimina rápidamente por el estado de lectura (`false` o `true`).
- **Nota Histórica**: El índice ya formaba parte de la migración inicial `0000_init.sql` y del archivo de definición `src/database/tandea.schema.ts`. En esta tarjeta se constató su presencia, integridad y orden de columnas mediante pruebas automatizadas.

---

## 📦 Migración y Realineamiento de Snapshots

### Archivo de Migración
- **Archivo**: `drizzle/migrations/0006_fcm_token.sql`
- **Sentencia SQL**:
  ```sql
  ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "fcm_token" text;
  ```
- **Naturaleza segura**: Operación no destructiva (`ADD COLUMN` nullable con cláusula `IF NOT EXISTS`), compatible con pre-deploy automático en Railway sin riesgo de bloqueo o pérdida de datos.

### Realineamiento de Snapshots Drizzle (`0006_snapshot.json`)
- Las migraciones previas `0004_password_reset_code.sql` y `0005_tanda_periodicity.sql` fueron añadidas sin sus respectivos archivos de snapshot en `drizzle/migrations/meta/`.
- Para prevenir que `drizzle-kit generate` detecte una falsa deriva de esquema (intentando recrear tablas existentes), se generó `0006_snapshot.json` con el estado completo actual del esquema (`password_reset_code`, `periodicity` y `fcm_token`), encadenado con `prevId` a `0003_snapshot.json`.
- A partir de este cambio, `npm run db:generate` confirma: `No schema changes, nothing to migrate`.

---

## 🧪 Verificación Manual en Entorno Local

> [!CAUTION]
> **REGLA ESTRICTA DE SEGURIDAD**: Nunca ejecutes comandos de migración o seeds apuntando a Railway (`rlwy.net` o `railway.internal`). Toda validación debe realizarse contra PostgreSQL local (`localhost`).

### 1. Aplicar migraciones en base local
```bash
# Asegúrate de que DATABASE_URL apunte a localhost
export DATABASE_URL="postgresql://postgres:password@localhost:5432/tandea_dev"
export DATABASE_SSL="false"

npm run db:migrate
```

### 2. Verificar columna e índice con `psql`
```sql
-- 1. Verificar columna fcm_token en tabla user
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user' AND column_name = 'fcm_token';

-- Resultado esperado:
-- column_name | data_type | is_nullable
-- ------------+-----------+-------------
-- fcm_token   | text      | YES

-- 2. Verificar índice en tabla notification
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notification' AND indexname = 'notification_user_read_idx';

-- Resultado esperado:
-- CREATE INDEX notification_user_read_idx ON public.notification USING btree (id_user, is_read)
```

### 3. Ejecutar pruebas automatizadas
```bash
# Pruebas unitarias y de esquema
npm run test

# Pruebas de integración con base de datos local
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/tandea_dev" npx vitest run test/bd-notif-fcm-token-index.spec.ts
```
