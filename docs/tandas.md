# 🏦 Módulo de Tandas — Documentación de Endpoints y Arquitectura

Bienvenido a la documentación oficial del módulo de **Tandas** de **Tandea Back-End**. Este módulo gestiona el ciclo de vida completo de una tanda financiera comunitaria, su configuración inicial, la asignación de turnos/números, la unión de participantes mediante código único, filtros avanzados y la administración con control de acceso por roles vía JWT.

---

## 🏛️ Arquitectura del Módulo

El módulo sigue los principios de **Arquitectura Hexagonal (Puertos y Adaptadores)** y **Clean Architecture**:

```
src/tandas/
├── domain/                               # Reglas de negocio e invariantes puras
│   ├── entities/
│   │   └── tanda.entity.ts               # Entidad de dominio Tanda y sus estados
│   ├── ports/
│   │   ├── in/
│   │   │   └── tanda-use-cases.port.ts   # Casos de uso (Driving / Inbound port)
│   │   └── out/
│   │       ├── tanda-repository.port.ts  # Contrato de persistencia de Tandas
│   │       └── number-repository.port.ts # Contrato de persistencia de Turnos/Números
│   └── utils/
│       └── invite-code.generator.ts      # Generador seguro de códigos de invitación
├── application/                          # Orquestación de casos de uso y DTOs
│   ├── dtos/
│   │   ├── create-tanda.dto.ts           # Validación de creación (Zod)
│   │   ├── update-tanda.dto.ts           # Validación de actualización (Zod)
│   │   ├── query-tandas.dto.ts           # Filtros, paginación y ordenamiento (Zod)
│   │   └── join-tanda.dto.ts             # Validación de unión a tanda (Zod)
│   └── services/
│       └── tanda.service.ts              # Implementación de TandaUseCasesPort
├── infrastructure/                       # Adaptadores de framework y tecnologías
│   ├── adapters/
│   │   ├── in/http/
│   │   │   └── tanda.controller.ts      # Controlador REST NestJS con JwtAuthGuard
│   │   └── out/database/
│   │       └── drizzle-tanda.repository.ts # Adaptador Drizzle ORM + PostgreSQL
│   └── tanda.module.ts                   # Registro del módulo e Inyección de Dependencias
```

---

## 🔐 Autenticación y Autorización (JWT)

Todos los endpoints (a excepción de consultas públicas si se requiriera) están protegidos mediante **`JwtAuthGuard`**.

### Cabecera Obligatoria
```http
Authorization: Bearer <jwt_token>
```

### Extracción de Identidad del Token
El payload del token JWT firmado contiene:
* `sub`: Identificador numérico del usuario (`idUser`).
* `role`: Rol asignado (`usuario` | `admin_global`).
* `email`: Correo electrónico institucional o personal del usuario.

El decorador personalizado `@CurrentUser()` extrae de forma automática y tipada el objeto `AuthenticatedUser`:
```typescript
interface AuthenticatedUser {
  idUser: number;
  email: string;
  role: string;
}
```

### Reglas de Pertenencia y Roles en la Tanda
Cuando un usuario consulta una tanda o el listado de tandas:
* **Dueño (`DUENO`)**: El usuario es el organizador de la tanda (`tanda.idAdmin === user.idUser`).
* **Participante (`PARTICIPANTE`)**: El usuario no es el creador, pero tiene al menos un turno registrado en la tabla `number` (`number.idUser === user.idUser`).
* **Ambos (`AMBOS`)**: El usuario es el creador de la tanda y a su vez participa con un número propio.
* **Administrador Global (`ADMIN_GLOBAL`)**: El usuario posee el rol `admin_global` en el token y puede consultar, suspender o supervisar cualquier tanda de la plataforma.

---

## 📡 Catálogo de Endpoints

| Método | Endpoint | Descripción | Roles Permitidos |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/tandas` | Crear una nueva tanda | `usuario`, `admin_global` |
| `POST` | `/api/v1/tandas/unirse` | Unirse a una tanda con código de invitación | `usuario`, `admin_global` |
| `GET` | `/api/v1/tandas` | Listar tandas (dueño/participante) con filtros y paginación | `usuario`, `admin_global` |
| `GET` | `/api/v1/tandas/codigo/:inviteCode` | Consultar datos de tanda por código de invitación | `usuario`, `admin_global` |
| `GET` | `/api/v1/tandas/:id` | Obtener detalle de tanda con turnos y participantes | Dueño, Participante, `admin_global` |
| `PATCH` | `/api/v1/tandas/:id` | Actualizar nombre y descripción de la tanda | Dueño, `admin_global` |
| `PATCH` | `/api/v1/tandas/:id/status` | Cambiar el estado de la tanda (`status`) | Dueño, `admin_global` |
| `DELETE` | `/api/v1/tandas/:id` | Eliminación lógica (Soft delete / Cancelación) | Dueño, `admin_global` |

---

## 🛠️ Especificación Detallada de los Endpoints

### 1. Crear Tanda
Permite a un usuario autenticado organizar y registrar una tanda. El organizador se vincula de manera transparente a partir de `user.idUser` del token JWT.

* **URL**: `POST /api/v1/tandas`
* **Status HTTP**: `201 Created`

#### Request Body (JSON)
```json
{
  "name": "Tanda Familia Pérez 2026",
  "description": "Ahorro mensual para vacaciones de diciembre",
  "startDate": "2026-11-01",
  "contributionAmount": 2500.00,
  "numParticipants": 10,
  "numRounds": 1,
  "graceDays": 3,
  "hasDeadNumber": true,
  "idTandaType": 1
}
```

#### Validaciones (Zod Schema)
* `name`: Obligatorio, mín. 3 caracteres, máx. 150.
* `description`: Opcional, máx. 500 caracteres.
* `startDate`: Obligatorio, formato estricto `YYYY-MM-DD`.
* `contributionAmount`: Número positivo mayor a 0.
* `numParticipants`: Entero entre 2 y 50 participantes.
* `numRounds`: Entero positivo (por defecto `1`).
* `graceDays`: Entero no negativo (por defecto `0`).
* `hasDeadNumber`: Booleano (por defecto `false`). Si es `true`, el último turno de la primera vuelta se reserva automáticamente para respaldo de impagos (`idUser = null`, `isDeadNumber = true`).
* `idTandaType`: Entero referenciando el catálogo de tipos de tanda (por defecto `1`).

#### Response (201 Created)
```json
{
  "statusCode": 201,
  "mensaje": "Tanda creada exitosamente",
  "data": {
    "idTanda": 14,
    "name": "Tanda Familia Pérez 2026",
    "description": "Ahorro mensual para vacaciones de diciembre",
    "startDate": "2026-11-01",
    "endDate": null,
    "contributionAmount": 2500,
    "numParticipants": 10,
    "numRounds": 1,
    "graceDays": 3,
    "hasDeadNumber": true,
    "idTandaType": 1,
    "idAdmin": 5,
    "status": "PENDIENTE",
    "active": true,
    "inviteCode": "TND-9X4K2P"
  }
}
```

---

### 2. Unirse a una Tanda
Permite a un participante incorporarse a una tanda pendiente mediante su código único.

* **URL**: `POST /api/v1/tandas/unirse`
* **Status HTTP**: `200 OK`

#### Request Body (JSON)
```json
{
  "inviteCode": "TND-9X4K2P",
  "selectedNumber": 3
}
```
> *Nota*: `selectedNumber` es opcional. Si no se envía, el sistema asigna automáticamente el primer turno disponible entre `1` y `numParticipants`.

#### Reglas de Negocio
1. La tanda debe encontrarse en estado `'PENDIENTE'`. Si está `ACTIVA`, `FINALIZADA` o `CANCELADA`, responde `400 Bad Request`.
2. El usuario no puede registrarse dos veces en la misma tanda (responde `409 Conflict`).
3. El número elegido no puede estar ocupado previamente (responde `409 Conflict`).
4. Si la incorporación completa el cupo de participantes (`numParticipants`), la tanda cambia automáticamente su estado a `'ACTIVA'`.

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "mensaje": "Te has unido exitosamente a la tanda",
  "data": {
    "tanda": {
      "idTanda": 14,
      "name": "Tanda Familia Pérez 2026",
      "status": "ACTIVA",
      "inviteCode": "TND-9X4K2P"
    },
    "numeroAsignado": 3,
    "isDeadNumber": false
  }
}
```

---

### 3. Listar Tandas con Filtros y Paginación
Obtiene las tandas vinculadas al usuario autenticado, resolviendo si es **dueño** o **participante**.

* **URL**: `GET /api/v1/tandas`
* **Status HTTP**: `200 OK`

#### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Por defecto | Descripción |
| :--- | :---: | :---: | :--- |
| `page` | `number` | `1` | Número de página (entero $\ge 1$). |
| `limit` | `number` | `10` | Registros por página (mín. 1, máx. 100). |
| `scope` | `string` | `'todos'` | Alcance: `'dueno'` (solo tandas creadas por mí), `'participante'` (solo donde tengo turno asignado) o `'todos'` (ambos). |
| `search` / `name` | `string` | — | Búsqueda parcial por nombre de tanda (insensible a mayúsculas/minúsculas). |
| `status` | `string` | — | Filtrar por estado: `'PENDIENTE'`, `'ACTIVA'`, `'FINALIZADA'`, `'SUSPENDIDA'`, `'CANCELADA'`. |
| `startDateFrom` | `string` | — | Fecha de inicio desde (`YYYY-MM-DD`). |
| `startDateTo` | `string` | — | Fecha de inicio hasta (`YYYY-MM-DD`). |
| `sortBy` | `string` | `'createdAt'` | Campo para ordenar: `'name'`, `'startDate'`, `'contributionAmount'`, `'createdAt'`. |
| `sortOrder` | `string` | `'desc'` | Dirección del ordenamiento: `'asc'` o `'desc'`. |

#### Ejemplo de Petición
```http
GET /api/v1/tandas?scope=todos&status=ACTIVA&search=Familia&sortBy=startDate&sortOrder=asc&page=1&limit=5
```

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "data": [
    {
      "idTanda": 14,
      "name": "Tanda Familia Pérez 2026",
      "description": "Ahorro mensual",
      "startDate": "2026-11-01",
      "endDate": null,
      "contributionAmount": 2500,
      "numParticipants": 10,
      "numRounds": 1,
      "graceDays": 3,
      "hasDeadNumber": true,
      "idTandaType": 1,
      "idAdmin": 5,
      "status": "ACTIVA",
      "active": true,
      "inviteCode": "TND-9X4K2P",
      "rolUsuario": "DUENO"
    },
    {
      "idTanda": 8,
      "name": "Tanda de la Oficina",
      "description": null,
      "startDate": "2026-11-15",
      "endDate": null,
      "contributionAmount": 1000,
      "numParticipants": 8,
      "numRounds": 1,
      "graceDays": 0,
      "hasDeadNumber": false,
      "idTandaType": 1,
      "idAdmin": 12,
      "status": "ACTIVA",
      "active": true,
      "inviteCode": "TND-4K7A8B",
      "rolUsuario": "PARTICIPANTE"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 5,
  "totalPages": 1
}
```

---

### 4. Consultar Tanda por Código de Invitación
Permite consultar los datos generales de una tanda antes de unirse.

* **URL**: `GET /api/v1/tandas/codigo/:inviteCode`
* **Status HTTP**: `200 OK`

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "data": {
    "idTanda": 14,
    "name": "Tanda Familia Pérez 2026",
    "description": "Ahorro mensual",
    "startDate": "2026-11-01",
    "contributionAmount": 2500,
    "numParticipants": 10,
    "status": "PENDIENTE",
    "inviteCode": "TND-9X4K2P"
  }
}
```

---

### 5. Obtener Detalle de Tanda por ID
Retorna la información completa de la tanda y el desglose de los turnos/participantes asignados.

* **URL**: `GET /api/v1/tandas/:id`
* **Status HTTP**: `200 OK`
* **Control de Acceso**: Solo permitido si el usuario es el **dueño**, un **participante** de la tanda, o tiene rol **`admin_global`**. De lo contrario retorna `403 Forbidden`.

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "data": {
    "idTanda": 14,
    "name": "Tanda Familia Pérez 2026",
    "description": "Ahorro mensual",
    "startDate": "2026-11-01",
    "contributionAmount": 2500,
    "numParticipants": 10,
    "numRounds": 1,
    "graceDays": 3,
    "hasDeadNumber": true,
    "idTandaType": 1,
    "idAdmin": 5,
    "status": "ACTIVA",
    "active": true,
    "inviteCode": "TND-9X4K2P",
    "rolUsuario": "DUENO",
    "participantes": [
      {
        "idNumber": 31,
        "idTanda": 14,
        "roundNumber": 1,
        "numberValue": 1,
        "idUser": 5,
        "isDeadNumber": false,
        "status": "PENDIENTE",
        "userName": "Brandon",
        "userEmail": "brandon@tandea.com"
      },
      {
        "idNumber": 32,
        "idTanda": 14,
        "roundNumber": 1,
        "numberValue": 2,
        "idUser": 8,
        "isDeadNumber": false,
        "status": "PENDIENTE",
        "userName": "Karen",
        "userEmail": "karen@tandea.com"
      },
      {
        "idNumber": 40,
        "idTanda": 14,
        "roundNumber": 1,
        "numberValue": 10,
        "idUser": null,
        "isDeadNumber": true,
        "status": "PENDIENTE",
        "userName": null,
        "userEmail": null
      }
    ]
  }
}
```

---

### 6. Actualizar Tanda
Permite modificar el nombre o descripción de la tanda.

* **URL**: `PATCH /api/v1/tandas/:id`
* **Status HTTP**: `200 OK`
* **Control de Acceso**: Solo permitido para el **dueño** o **`admin_global`**.
* **Regla de Negocio**: No se permite editar una tanda en estado `FINALIZADA` o `CANCELADA`. Tampoco se permite modificar el monto de contribución o los cupos una vez creada para garantizar la integridad financiera.

#### Request Body (JSON)
```json
{
  "name": "Tanda Familia Pérez Actualizada",
  "description": "Descripción editada"
}
```

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "mensaje": "Tanda actualizada exitosamente",
  "data": {
    "idTanda": 14,
    "name": "Tanda Familia Pérez Actualizada",
    "description": "Descripción editada",
    "status": "ACTIVA"
  }
}
```

---

### 7. Cambiar Estado de la Tanda
Permite transicionar el ciclo de vida de la tanda (`PENDIENTE` $\to$ `ACTIVA` $\to$ `FINALIZADA` / `CANCELADA` / `SUSPENDIDA`).

* **URL**: `PATCH /api/v1/tandas/:id/status`
* **Status HTTP**: `200 OK`
* **Control de Acceso**: Solo permitido para el **dueño** o **`admin_global`**.

#### Request Body (JSON)
```json
{
  "status": "ACTIVA"
}
```

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "mensaje": "Estado de tanda actualizado exitosamente",
  "data": {
    "idTanda": 14,
    "status": "ACTIVA"
  }
}
```

---

### 8. Eliminar Tanda (Soft Delete)
Aplica una eliminación lógica sobre la tanda (`active = false`, `deletedAt = now()`, `status = 'CANCELADA'`).

* **URL**: `DELETE /api/v1/tandas/:id`
* **Status HTTP**: `200 OK`
* **Control de Acceso**: Solo permitido para el **dueño** o **`admin_global`**.

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "mensaje": "Tanda eliminada exitosamente"
}
```

---

## ⚠️ Estándar y Códigos de Error HTTP (Mejores Prácticas REST)

Todas las respuestas de error en la API están interceptadas por el `GlobalExceptionFilter` y siguen una estructura JSON clara, predecible y estandarizada:

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Error de validación: uno o más campos son inválidos o faltan en la petición.",
  "details": [
    {
      "field": "name",
      "message": "El campo \"name\" (nombre de la tanda) es obligatorio",
      "code": "invalid_type"
    }
  ],
  "timestamp": "2026-10-14T07:45:00.000Z",
  "path": "/api/v1/tandas"
}
```

| Código HTTP | Error Name | Causa / Cuándo ocurre | Formato de Respuesta |
| :---: | :--- | :--- | :--- |
| **`400`** | `Bad Request` | Violación de reglas de dominio o error de integridad referencial (ej. enviar `idTandaType: 99` inexistente). | Mensaje claro indicando el campo y tabla afectada (`code: "FOREIGN_KEY_NOT_FOUND"` o `"DOMAIN_RULE_VIOLATION"`). |
| **`401`** | `Unauthorized` | Token JWT ausente, expirado o malformado en `Authorization: Bearer <token>`. | `{"statusCode": 401, "message": "Token inválido o malformado"}` |
| **`403`** | `Forbidden` | El usuario autenticado no tiene permisos para acceder o modificar esa tanda. | `{"statusCode": 403, "message": "Solo el organizador o administrador puede editar la tanda"}` |
| **`404`** | `Not Found` | La tanda solicitada por ID o código no existe o fue eliminada lógicamente. | `{"statusCode": 404, "message": "Tanda con id X no encontrada"}` |
| **`409`** | `Conflict` | Conflicto de unicidad o negocio (ej. código duplicado o turno ya ocupado). | `{"statusCode": 409, "message": "El turno número X ya está ocupado"}` |
| **`422`** | `Unprocessable Entity` | Fallo de validación Zod en el body o query params (campo faltante, formato de fecha inválido o tipo incorrecto). | Retorna lista `details` con cada campo exacto (`field`), código (`code`) y mensaje en español. |
| **`500`** | `Internal Server Error` | Excepción crítica no controlada (en modo desarrollo incluye stack y detalle del error). | `{"statusCode": 500, "message": "Ocurrió un error interno en el servidor."}` |

---

## 🧪 Pruebas Unitarias

El módulo cuenta con cobertura de pruebas en [test/tanda.spec.ts](file:///c:/Users/brand/Documentos/GIDS6102/Tandea/Tandea-Back-End/test/tanda.spec.ts):

* Creación de tanda y validación de formato del código único alfanumérico (`TND-XXXXXX`).
* Reserva del turno muerto para respaldo de impagos (`hasDeadNumber = true`).
* Autorización estricta por roles (`DUENO`, `PARTICIPANTE`, `AMBOS`, `ADMIN_GLOBAL`).
* Paginación, cálculo de `totalPages` y filtros combinados.
* Edición controlada y rechazo a usuarios no autorizados.
* Soft delete preservando la integridad referencial.
* Asignación manual y automática de números con prevención de colisiones.
