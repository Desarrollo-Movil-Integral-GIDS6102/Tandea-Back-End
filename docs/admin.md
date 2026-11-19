# 🛡️ Módulo de Administración Global (`AdminModule`) — Tandea Back-End

Documentación técnica del módulo de **Administración Global y Gestión de Disputas**, desarrollado bajo **Arquitectura Hexagonal (Puertos y Adaptadores)** y **Domain-Driven Design (DDD)** sobre NestJS, Fastify, Drizzle ORM y PostgreSQL.

---

## 🏛️ Arquitectura Hexagonal del Módulo

```text
src/admin/
├── domain/                                  # 1. NÚCLEO: Contratos y puertos puros
│   └── ports/
│       ├── in/
│       │   ├── admin-metricas-use-case.port.ts  # Caso de uso de métricas globales (AP-11)
│       │   ├── admin-usuarios-use-case.port.ts  # Caso de uso de búsqueda y suspensión de usuarios
│       │   ├── admin-disputas-use-case.port.ts  # Caso de uso de creación y resolución de disputas
│       │   └── admin-config-use-case.port.ts    # Caso de uso de parámetros globales (platform_config)
│       └── out/
│           ├── admin-metricas-repository.port.ts
│           ├── admin-usuarios-repository.port.ts
│           ├── admin-disputas-repository.port.ts
│           ├── admin-config-repository.port.ts
│           └── admin-events.port.ts             # Puerto de eventos (usuario.suspendido, disputa.resuelta)
├── application/                             # 2. APLICACIÓN: Orquestación y reglas de negocio
│   ├── dtos/
│   │   ├── admin-usuarios.dto.ts            # Validación Zod de filtros y suspensión
│   │   ├── admin-disputas.dto.ts            # Validación Zod (prohíbe modificar montos directamente)
│   │   └── admin-config.dto.ts              # Validación Zod de límites de plataforma
│   └── services/
│       ├── admin-metricas.service.ts
│       ├── admin-usuarios.service.ts
│       ├── admin-disputas.service.ts
│       └── admin-config.service.ts
├── infrastructure/                          # 3. INFRAESTRUCTURA: Adaptadores primarios y secundarios
│   └── adapters/
│       ├── in/
│       │   ├── http/
│       │   │   ├── admin.controller.ts      # Endpoints exclusivos para rol `admin_global`
│       │   │   └── disputas.controller.ts   # Endpoint POST /disputas para miembros de tanda
│       │   └── events/
│       │       └── admin-events.listener.ts # Listener @OnEvent -> envío de correos vía MailPort
│       └── out/
│           ├── database/
│           │   ├── drizzle-admin-metricas.repository.ts
│           │   ├── drizzle-admin-usuarios.repository.ts
│           │   ├── drizzle-admin-disputas.repository.ts
│           │   └── drizzle-admin-config.repository.ts
│           └── events/
│               └── event-emitter-admin-events.adapter.ts # Publicador sobre EventEmitter2
└── admin.module.ts                          # Ensamblaje e inyección de dependencias NestJS
```

---

## 🌐 1. Endpoints HTTP

Todos los endpoints bajo `/api/v1/admin/*` están protegidos por `JwtAuthGuard`, `RolesGuard` y el decorador `@Roles('admin_global')`.

| Método | Ruta | Rol requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/metricas` | `admin_global` | Obtiene totales globales de usuarios, tandas, monto gestionado, disputas pendientes y serie mensual de 12 meses (AP-11). |
| `GET` | `/api/v1/admin/usuarios` | `admin_global` | Busca usuarios por nombre, apellido o correo (`?q=`) y filtra por estado (`?active=true\|false`). |
| `PATCH` | `/api/v1/admin/usuarios/:id/suspender` | `admin_global` | Suspende una cuenta (`active = false`), registra la acción en `audit_log` y emite `usuario.suspendido`. |
| `POST` | `/api/v1/disputas` | Miembro de tanda | Permite a un participante u organizador abrir una disputa asociada a una tanda, pago o entrega. |
| `GET` | `/api/v1/admin/disputas` | `admin_global` | Lista las disputas reportadas con filtros opcionales (`?status=&idTanda=`). |
| `GET` | `/api/v1/admin/disputas/:id` | `admin_global` | Obtiene el detalle de una disputa junto con su historial en `audit_log`. |
| `PATCH` | `/api/v1/admin/disputas/:id/resolver` | `admin_global` | Resuelve una disputa (`accion: 'mantener' \| 'revertir' \| 'suspender'`, `notas`), guarda en `audit_log` y emite `disputa.resuelta`. **Prohibido modificar montos directamente.** |
| `GET` | `/api/v1/admin/config` | `admin_global` | Consulta los límites globales de `platform_config` (`maxUsersPerTanda`, `maxActiveTandasPerUser`, `maxGraceDays`). |
| `PUT` | `/api/v1/admin/config` | `admin_global` | Actualiza los límites globales de la plataforma y registra `id_updated_by`. |

---

## 📣 2. Eventos de Dominio y Notificaciones por Correo (`SP-4 [INT-ADMIN]`)

Para mantener el dominio desacoplado del proveedor de correo electrónico, los servicios de aplicación publican eventos de dominio a través del puerto `ADMIN_EVENTS_PORT` (`EventEmitterAdminEventsAdapter`) y el adaptador de entrada `AdminEventsListener` los procesa de manera asíncrona reutilizando `MAIL_PORT` (`BrevoMailAdapter`) y `EmailTemplates`.

### Eventos Emitidos (`AdminEventsPort`)

| Evento | Constante | Payload | Cuándo se emite |
| :--- | :--- | :--- | :--- |
| `usuario.suspendido` | `USUARIO_SUSPENDIDO_EVENT` | `{ idUser, name, lastName, email, motivo? }` | En `AdminUsuariosService.suspenderUsuario()`, tras persistir `suspenderConAuditoria`. |
| `disputa.resuelta` | `DISPUTA_RESUELTA_EVENT` | `{ idDispute, idTanda, nombreTanda, emailReporter, nombreReporter, accion, notas }` | En `AdminDisputasService.resolverDisputa()`, tras persistir `resolverConAuditoria`. |

### Plantillas Corporativas (`EmailTemplates`)

Definidas en `src/common/templates/mail/email-templates.ts`:
1. **`EmailTemplates.userSuspended({ name, motivo })`**:
   - Informa al usuario que su cuenta ha sido suspendida por el Administrador Global e incluye el motivo registrado.
2. **`EmailTemplates.disputeResolved({ name, idDispute, nombreTanda, accion, notas })`**:
   - Envía al usuario que reportó la disputa un resumen con el folio `#idDispute`, el nombre de la tanda, la decisión aplicada (`mantener`, `revertir` o `suspender`) y las notas de resolución.

### Resiliencia y Tolerancia a Fallos

* `AdminEventsListener` escucha `@OnEvent('usuario.suspendido', { async: true })` y `@OnEvent('disputa.resuelta', { async: true })`.
* **Regla crítica de resiliencia**: Si `mailPort.sendMail(...)` devuelve `false` (ej. `BREVO_API_KEY` no configurada o rechazo HTTP de Brevo) o lanza una excepción de red, el listener captura el fallo dentro de un bloque `try/catch` y lo registra con `this.logger.error(...)`.
* **En ningún caso** un fallo del servicio de correo revierte la transacción en base de datos, altera el registro en `audit_log` ni propaga errores HTTP 500 al Administrador Global.

---

## 🧪 3. Pruebas Automatizadas

```bash
# Ejecutar pruebas unitarias de usuarios y suspensión
npx vitest run src/admin/application/services/admin-usuarios.service.spec.ts

# Ejecutar pruebas unitarias de disputas y resolución
npx vitest run src/admin/application/services/admin-disputas.service.spec.ts

# Ejecutar pruebas del listener de correo y resiliencia (SP-4 INT-ADMIN)
npx vitest run src/admin/infrastructure/adapters/in/events/admin-events.listener.spec.ts

# Ejecutar pruebas de configuración y métricas globales
npx vitest run src/admin/application/services/admin-config.service.spec.ts
npx vitest run src/admin/application/services/admin-metricas.service.spec.ts
```
