# Tandea — Backend API

Backend del sistema **Tandea**, una plataforma moderna para la administración y gestión transparente de fondos de ahorro rotativo (tandas). Diseñado como un **Monolito Modular** construido con **NestJS**, **Fastify**, **Drizzle ORM** y **PostgreSQL**, siguiendo estrictamente los principios de **Arquitectura Hexagonal (Puertos y Adaptadores)** y **Domain-Driven Design (DDD)**.

---

## 📑 Tabla de Contenidos
1. [Visión General y Propósito](#-visión-general-y-propósito)
2. [Stack Tecnológico](#-stack-tecnológico)
3. [Arquitectura Hexagonal (Puertos y Adaptadores)](#-arquitectura-hexagonal-puertos-y-adaptadores)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Guía de Inicio y Puesta en Marcha](#-guía-de-inicio-y-puesta-en-marcha)
6. [Variables de Entorno](#-variables-de-entorno)
7. [Scripts Disponibles](#-scripts-disponibles)
8. [Integración Continua (GitHub Actions)](#-integración-continua-github-actions)
9. [Especificación de la API (Endpoints)](#-especificación-de-la-api-endpoints)
10. [Reglas de Negocio del Dominio](#-reglas-de-negocio-del-dominio)
11. [Instrucciones Críticas para Asistentes de IA y Desarrolladores](#-instrucciones-críticas-para-asistentes-de-ia-y-desarrolladores)
12. [Despliegue en Railway](#-despliegue-en-railway)

---

## 🎯 Visión General y Propósito

Tandea digitaliza la gestión de tandas tradicionales:
* **Gestión de rondas y participantes:** Asignación de turnos y números de pago.
* **Control de pagos multicanal:** Pagos en efectivo, por transferencia o híbridos.
* **Flujo de doble confirmación del pago:** el **participante** confirma al registrar su pago y el **organizador** lo confirma al validar que recibió el dinero. La confirmación del **receptor** (ganador del turno) pertenece a la entrega del dinero (`payout`, módulo de entregas).
* **Validación de comprobantes con OCR:** Comparación automática del comprobante bancario contra el monto esperado.

El backend está optimizado para alta concurrencia y bajo consumo de recursos utilizando **Fastify** como motor HTTP.

---

## 🛠 Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
| :--- | :--- | :--- | :--- |
| **Lenguaje** | TypeScript | `^6.0.0` | Tipado estático estricto y seguro |
| **Framework** | NestJS | `^12.0.1` | Contenedor de Inyección de Dependencias y modularización |
| **Servidor HTTP** | Fastify (`@nestjs/platform-fastify`) | `^5.12.5` | Motor HTTP de alto rendimiento |
| **Base de Datos** | PostgreSQL | `>= 15` | Almacenamiento relacional transaccional |
| **ORM / Query Builder** | Drizzle ORM + Drizzle Kit | `^0.44.7` | Tipado SQL directo, rápido y sin sobrecarga |
| **Driver BD** | `pg` (node-postgres) | `^8.23.1` | Conexión de bajo nivel mediante pool |
| **Validación & DTOs** | Zod | `^3.25.76` | Validación en tiempo de ejecución y parseo estricto |
| **Linter** | Oxlint (`oxlint --type-aware`) | `^1.58.0` | Linter ultra-rápido basado en Rust |
| **Test Runner** | Vitest | `^4.1.2` | Ejecución veloz de pruebas unitarias e integración |

---

## 🔷 Arquitectura Hexagonal (Puertos y Adaptadores)

El sistema separa estrictamente la lógica del negocio de los detalles técnicos y de infraestructura:

```text
               ADAPTADORES DE ENTRADA (Driving / Inbound)
                   [ HTTP Controller (Fastify) ]
                               │
                               ▼
                   PUERTO DE ENTRADA (Inbound Port)
                  [ PagoUseCasesPort / Interface ]
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      ▼                      │
        │             CAPA DE APLICACIÓN              │
        │                [ PagoService ]              │
        │                      │                      │
        │                      ▼                      │
        │               CAPA DE DOMINIO               │
        │         [ Entidad Rica: Pago (DDD) ]         │
        │         [ Errores: DomainError ]            │
        │                      │                      │
        │                      ▼                      │
        │           PUERTO DE SALIDA (Outbound Port)  │
        │          [ PagoRepositoryPort / Interface ] │
        └──────────────────────┬──────────────────────┘
                               │
                               ▼
               ADAPTADORES DE SALIDA (Driven / Outbound)
               [ DrizzlePagoRepository + Drizzle Schema ]
                               │
                               ▼
                         [ PostgreSQL ]
```

### Principios Fundamentales:
1. **Dominio Agnóstico (`src/<modulo>/domain`):**
   - TypeScript puro. **Prohibido importar `@nestjs/*`, `fastify`, `drizzle-orm` o paquetes de transporte/persistencia.**
   - Las entidades encapsulan estado y métodos de negocio (`confirmarPorParticipante()`, `confirmarPorOrganizador()`, etc.).
   - Lanza errores puros que heredan de `DomainError` (ej. `PagoYaConfirmadoError`).
2. **Puertos (`domain/ports/`):**
   - **Inbound Ports (`ports/in/`):** Interfaces que exponen los casos de uso disponibles (`PagoUseCasesPort`).
   - **Outbound Ports (`ports/out/`):** Interfaces que definen los contratos requeridos por el dominio para interactuar con el exterior (`PagoRepositoryPort`).
3. **Capa de Aplicación (`src/<modulo>/application`):**
   - Implementa los puertos de entrada a través de servicios o casos de uso (`PagoService`).
   - Orquesta la carga de entidades desde los puertos de salida, invoca las reglas de negocio de la entidad y persiste los cambios.
   - Maneja los DTOs y validaciones de entrada/salida basadas en Zod.
4. **Capa de Infraestructura (`src/<modulo>/infrastructure`):**
   - **Adaptadores de entrada (`adapters/in/`):** Controllers HTTP de NestJS, filtros de excepciones (`PagoDomainExceptionFilter`).
   - **Adaptadores de salida (`adapters/out/`):** Implementaciones de repositorios con Drizzle (`DrizzlePagoRepository`), esquemas de base de datos (`pago.schema.ts`) y mappers (`pago.mapper.ts`).
5. **Inversión de Dependencias (Tokens):**
   - Dado que TypeScript borra las interfaces en tiempo de compilación, NestJS inyecta dependencias usando `Symbol` tokens:
     - `PAGO_REPOSITORY_PORT`: Resuelve a `DrizzlePagoRepository`.
     - `PAGO_SERVICE_PORT`: Resuelve a `PagoService`.
     - `DATABASE_TOKEN`: Resuelve a la instancia de `drizzle(pool)`.

---

## 📁 Estructura del Proyecto

```text
Tandea-Back-End/
├── drizzle/                                # Migraciones SQL generadas por Drizzle Kit
├── src/
│   ├── common/                             # Utilidades y componentes transversales
│   │   ├── filters/
│   │   │   └── zod-validation.filter.ts    # Filtro global: ZodError ➔ HTTP 422
│   │   └── tokens.ts                       # Tokens globales de inyección (ej. DATABASE_TOKEN)
│   ├── database/                           # Módulo global de conexión a la base de datos
│   │   └── database.module.ts              # Proveedor @Global() con pool PostgreSQL + Drizzle
│   ├── pagos/                              # Módulo funcional de Pagos (Arquitectura Hexagonal)
│   │   ├── domain/                         # 1. NÚCLEO: Dominio puro
│   │   │   ├── entities/
│   │   │   │   └── pago.entity.ts          # Entidad rica Pago con reglas de transición
│   │   │   ├── errors/
│   │   │   │   └── pago.errors.ts          # Jerarquía DomainError agnóstica de HTTP
│   │   │   └── ports/
│   │   │       ├── in/
│   │   │       │   └── pago-use-cases.port.ts   # Interfaz de casos de uso (PAGO_SERVICE_PORT)
│   │   │       └── out/
│   │   │           └── pago-repository.port.ts  # Interfaz de repositorio (PAGO_REPOSITORY_PORT)
│   │   ├── application/                    # 2. APLICACIÓN: Orquestación
│   │   │   ├── dtos/
│   │   │   │   └── pago.dto.ts             # Schemas Zod: zPagoCreate, zPagoResponse
│   │   │   └── services/
│   │   │       └── pago.service.ts         # Implementación de PagoUseCasesPort
│   │   ├── infrastructure/                 # 3. INFRAESTRUCTURA: Adaptadores
│   │   │   └── adapters/
│   │   │       ├── in/http/                # Adaptadores primarios (HTTP)
│   │   │       │   ├── controllers/
│   │   │       │   │   └── pago.controller.ts
│   │   │       │   └── filters/
│   │   │       │       └── pago-domain-exception.filter.ts # DomainError ➔ 404/422
│   │   │       └── out/database/           # Adaptadores secundarios (Drizzle/Postgres)
│   │   │           ├── schema/
│   │   │           │   └── pago.schema.ts  # Tabla 'pagos' en Drizzle ORM
│   │   │           ├── mappers/
│   │   │           │   └── pago.mapper.ts  # PagoRow ↔ Pago Entity ↔ PagoResponseDto
│   │   │           └── drizzle-pago.repository.ts # Implementa PagoRepositoryPort
│   │   └── pago.module.ts                  # NestJS Module uniendo puertos y adaptadores
│   ├── tandas/                             # Módulo funcional de Tandas (Arquitectura Hexagonal)
│   │   ├── domain/                         # 1. NÚCLEO: Dominio puro
│   │   │   ├── entities/
│   │   │   │   ├── tanda.entity.ts         # Entidad rica Tanda (validaciones, estados)
│   │   │   │   └── numero-tanda.entity.ts  # Entidad rica NumeroTanda (asignación atómica AP-02)
│   │   │   ├── errors/
│   │   │   │   ├── tanda.errors.ts         # DomainError y PlanTandaInvalidoError
│   │   │   │   └── numero.errors.ts        # NumeroYaTomadoError, NumeroMuertoNoElegibleError, etc.
│   │   │   ├── services/
│   │   │   │   └── calcular-plan.ts        # Cálculo puro de plan financiero y turnos (AP-01)
│   │   │   └── ports/
│   │   │       ├── in/
│   │   │       │   ├── tanda-use-cases.port.ts
│   │   │       │   ├── create-tanda-use-case.port.ts
│   │   │       │   └── elegir-numero-use-case.port.ts
│   │   │       └── out/
│   │   │           ├── tanda-repository.port.ts
│   │   │           └── number-repository.port.ts
│   │   ├── application/                    # 2. APLICACIÓN: Orquestación
│   │   │   ├── dtos/
│   │   │   └── services/
│   │   │       ├── tanda.service.ts
│   │   │       └── elegir-numero.service.ts
│   │   ├── infrastructure/                 # 3. INFRAESTRUCTURA: Adaptadores
│   │   │   └── adapters/
│   │   │       ├── in/http/
│   │   │       │   ├── tanda.controller.ts
│   │   │       │   └── filters/
│   │   │       │       └── tanda-domain-exception.filter.ts # DomainError ➔ 404/409/400/422
│   │   │       └── out/database/
│   │   │           ├── mappers/
│   │   │           │   └── numero.mapper.ts
│   │   │           └── drizzle-tanda.repository.ts # Implementa TandaRepositoryPort y NumberRepositoryPort
│   │   └── tanda.module.ts                 # NestJS Module conectando puertos y adaptadores
│   ├── app.controller.ts                   # Controlador de salud/bienvenida
│   ├── app.module.ts                       # Módulo raíz que importa módulos de negocio
│   └── main.ts                             # Entrada principal de la aplicación Fastify
├── test/                                   # Pruebas e2e globales
├── .env.example                            # Plantilla de variables de entorno requeridas
├── .gitignore                              # Reglas de exclusión de Git
├── drizzle.config.ts                       # Configuración de Drizzle Kit (escaneo de esquemas)
├── package.json                            # Scripts, dependencias y metadatos
├── tsconfig.json                           # Configuración del compilador TypeScript
└── vitest.config.ts                        # Configuración de pruebas Vitest
```

---

## 🚀 Guía de Inicio y Puesta en Marcha

### Prerrequisitos
1. **Node.js**: Versión `>= 20.0.0` (recomendado Node 20 LTS o 22 LTS).
2. **PostgreSQL**: Instancia corriendo localmente o en contenedor (ej. Docker) en puerto `5432`.

### Paso 1: Clonar y Acceder
```bash
cd Tandea-Back-End
```

### Paso 2: Configurar Variables de Entorno
Copia el archivo de plantilla `.env.example` a `.env`:
```bash
# En Windows (PowerShell)
Copy-Item .env.example .env

# En Linux/macOS
cp .env.example .env
```

Edita `.env` con las credenciales de tu base de datos PostgreSQL local:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/tandea_dev
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

> **Nota:** La base de datos `tandea_dev` debe existir en tu PostgreSQL. Si no existe, créala con:
> ```sql
> CREATE DATABASE tandea_dev;
> ```

### Paso 3: Instalar Dependencias
```bash
npm install
```

### Paso 4: Sincronizar Esquema de Base de Datos
Drizzle Kit leerá todos los esquemas en `src/**/*.schema.ts` y creará las tablas en PostgreSQL:

* **Opción rápida (desarrollo):** Empuja los esquemas directamente a la base de datos sin generar archivos SQL de migración:
  ```bash
  npm run db:push
  ```
* **Opción formal (migraciones versionadas):**
  ```bash
  npm run db:generate   # Genera archivos SQL en /drizzle/migrations
  npm run db:migrate    # Aplica las migraciones a PostgreSQL
  ```

### Paso 5: Iniciar el Servidor de Desarrollo
```bash
npm run start:dev
```
La consola indicará:
```text
🚀 Tandea API corriendo en: http://localhost:3000/api/v1
```

---

## ⚙ Variables de Entorno

| Variable | Tipo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | string (URI) | *Requerido* | Conexión PostgreSQL en formato `postgresql://user:pass@host:port/dbname` |
| `PORT` | number | `3000` | Puerto en el que escucha el servidor Fastify |
| `NODE_ENV` | string | `development` | Entorno de ejecución (`development`, `production`, `test`) |
| `CORS_ORIGIN` | string | `*` | Orígenes permitidos para peticiones CORS (ej. `http://localhost:5173`) |

---

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm run start:dev      # Inicia el servidor con recarga en vivo (watch mode)
npm run start:debug    # Inicia en modo depuración (inspector activado)

# Compilación y Producción
npm run build          # Compila el código TypeScript a JavaScript en /dist
npm run start:prod     # Ejecuta la versión compilada desde dist/main.js

# Calidad de Código y Tipado
npm run lint           # Ejecuta Oxlint con chequeo estricto de tipos (--type-aware)
npm run format         # Formatea todo el código con Prettier

# Pruebas
npm run test           # Ejecuta la suite de pruebas unitarias con Vitest
npm run test:watch     # Modo interactivo de pruebas en tiempo real
npm run test:cov       # Genera reporte de cobertura de código
npm run test:e2e       # Ejecuta las pruebas end-to-end

# Base de Datos (Drizzle Kit y Seeds)
npm run db:push        # Sincroniza esquemas directamente a PostgreSQL (útil en dev)
npm run db:generate    # Genera archivos SQL de migración basados en los schemas
npm run db:migrate     # Ejecuta las migraciones pendientes en PostgreSQL
npm run db:seed        # Ejecuta el seed idempotente de tipos de tanda (familiar, laboral, amigos)
npm run db:studio      # Abre la interfaz visual de Drizzle Studio en el navegador
```

### 🧪 Ejecución de Seeds y Pruebas de Integración con Base de Datos Local

> [!WARNING]
> **REGLA DE SEGURIDAD ESTRICTA:** Está terminantemente **PROHIBIDO** ejecutar seeds, migraciones destructivas o pruebas de integración contra la base de datos de Railway. Los scripts y tests validan automáticamente el host de conexión y abortan si detectan `rlwy.net` o `railway.internal`.

#### 1. Cargar Seed de Tipos de Tanda (`tanda_type`)
El script `npm run db:seed` es **idempotente** (ejecutarlo múltiples veces no duplica filas). Inserta los tres tipos de tanda base (`familiar`, `laboral`, `amigos`) dentro de una transacción verificando previamente si ya existen:

```bash
# Requiere que DATABASE_URL apunte a tu PostgreSQL local
npm run db:seed
```

#### 2. Correr Pruebas de Integración con `TEST_DATABASE_URL`
Las pruebas de integración de base de datos (`test/number-unique.e2e-spec.ts` y `test/numero-concurrencia.e2e-spec.ts`) validan la restricción única compuesta `(id_tanda, round_number, number_value)` con código `23505` de PostgreSQL y la asignación atómica bajo concurrencia con `Promise.all`.

Por seguridad, estas pruebas **solo se ejecutan si la variable `TEST_DATABASE_URL` está definida** (con `describe.skipIf`) y siempre contra una base de datos local:

```bash
# En Windows (PowerShell):
$env:TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/tandea_dev"
npm run test:e2e

# En Linux / macOS:
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/tandea_dev" npm run test:e2e
```


---

## 🔁 Integración Continua (GitHub Actions)

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada Pull Request y en cada push a `main` y `develop`. Un PR solo debe mergearse con todos los jobs en verde.

| Job | Qué hace |
| :--- | :--- |
| **Lint, build y pruebas** | `npm ci`, `npm run lint`, `npm run build` y `npm test` con Node 22. |
| **Pruebas de integración (PostgreSQL)** | Levanta un `postgres:16` temporal en el runner, aplica las migraciones (`npm run db:migrate`) y corre `test/number-unique.e2e-spec.ts` y `test/numero-concurrencia.e2e-spec.ts`. |

* La base de datos del CI se crea y se destruye en cada ejecución; **nunca** se conecta a Railway y no usa secretos del repositorio.
* `test/app.e2e-spec.ts` no se ejecuta en CI: usa la plataforma Express, que el proyecto (Fastify) no instala.
* Para reproducir el primer job en local antes de abrir un PR:

```bash
npm ci && npm run lint && npm run build && npm test
```

---

## 📡 Especificación de la API (Endpoints)

Todas las rutas tienen el prefijo global: **`/api/v1`**.

### Módulo: Autenticación (`/api/v1/auth`)

#### 1. Registrar Usuario
* **Método:** `POST`
* **Ruta:** `/api/v1/auth/register`
* **Estado Exitoso:** `201 Created`
* **Cuerpo de la Petición (`Content-Type: application/json`):**
```json
{
  "email": "nuevo_usuario@ejemplo.com",
  "password": "PasswordSeguro123!",
  "name": "Juan",
  "lastName": "Pérez",
  "age": 28,
  "gender": "M"
}
```
* **Respuesta (`201 Created`):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "idUser": 1,
    "email": "nuevo_usuario@ejemplo.com",
    "name": "Juan",
    "lastName": "Pérez",
    "role": "usuario",
    "age": 28,
    "gender": "M"
  }
}
```

#### 2. Iniciar Sesión (Login)
* **Método:** `POST`
* **Ruta:** `/api/v1/auth/login`
* **Estado Exitoso:** `200 OK`
* **Cuerpo de la Petición:**
```json
{
  "email": "nuevo_usuario@ejemplo.com",
  "password": "PasswordSeguro123!"
}
```
* **Respuesta (`200 OK`):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "idUser": 1,
    "email": "nuevo_usuario@ejemplo.com",
    "name": "Juan",
    "lastName": "Pérez",
    "role": "usuario"
  }
}
```

#### 3. Perfil del Usuario Autenticado
* **Método:** `GET`
* **Ruta:** `/api/v1/auth/profile`
* **Cabecera requerida:** `Authorization: Bearer <token>`
* **Estado Exitoso:** `200 OK`

---

### Módulo: Pagos (`/api/v1/pagos`)

#### 1. Registrar Pago
* **Método:** `POST`
* **Ruta:** `/api/v1/pagos`
* **Cabecera requerida:** `Authorization: Bearer <token>` (el número debe pertenecer al usuario del token)
* **Cuerpo de la Petición (`Content-Type: multipart/form-data`):**

| Campo | Tipo | Descripción |
|---|---|---|
| `idNumber` | entero | Número (turno) del participante que paga. La cuota se toma de su tanda. |
| `metodoPago` | texto | `efectivo`, `transferencia` o `hibrido`. |
| `transferAmount` | número | Monto por transferencia (máx. 2 decimales). |
| `cashAmount` | número | Monto en efectivo (máx. 2 decimales). |
| `file` | archivo | Comprobante JPG, PNG o PDF de hasta 10 MB. Obligatorio en `transferencia` e `hibrido`. |

```bash
curl -X POST {{baseUrl}}/pagos   -H "Authorization: Bearer <token>"   -F idNumber=12 -F metodoPago=hibrido   -F transferAmount=600 -F cashAmount=400   -F file=@spei.png
```
* **Respuesta (`201 Created`):**
```json
{
  "idPayment": 45,
  "idNumber": 12,
  "metodoPago": "hibrido",
  "transferAmount": 600,
  "cashAmount": 400,
  "totalAmount": 1000,
  "status": "PENDIENTE",
  "confirmedByParticipant": true,
  "confirmedByAdmin": false,
  "ocrVerified": false,
  "ocrDetectedAmount": null,
  "evidenceUrl": "https://res.cloudinary.com/<cloud>/image/upload/comprobantes/pago_numero_12_1760000000000.png",
  "createdAt": "2026-10-05T16:20:00.000Z",
  "updatedAt": "2026-10-05T16:20:00.000Z"
}
```
* **Errores:**
  - `400 Bad Request`: El comprobante no es JPG, PNG o PDF, o está vacío.
  - `403 Forbidden`: El número no pertenece al usuario del token (`NumeroAjenoError`).
  - `404 Not Found`: El número o su tanda no existen.
  - `409 Conflict`: Ya hay un pago pendiente o confirmado para ese número (`PagoDuplicadoError`).
  - `413 Payload Too Large`: El comprobante pesa más de 10 MB.
  - `422 Unprocessable Entity`: Campos inválidos, la suma no coincide con la cuota o falta el comprobante.

#### 2. Obtener Pago por ID
* **Método:** `GET`
* **Ruta:** `/api/v1/pagos/:id`
* **Parámetros:** `:id` (entero, `idPayment`)
* **Respuestas:**
  - `200 OK`: Retorna el objeto `PagoResponseDto` (mismos campos que la respuesta de registro).
  - `404 Not Found`: Si el pago no existe (`PagoNotFoundError`).

#### 3. Confirmación del Organizador
* **Método:** `PATCH`
* **Ruta:** `/api/v1/pagos/:id/confirmar-organizador`
* **Cabecera requerida:** `Authorization: Bearer <token>` del **organizador** de la tanda (`tanda.id_admin`).
* **Descripción:** El organizador valida que recibió el pago en efectivo o verificó la transferencia. El participante ya confirmó al registrar el pago (`confirmed_by_participant = true`), así que esta confirmación cierra la doble confirmación.
* **Transición de Estado:** Pasa de `PENDIENTE` a `CONFIRMADO` (`confirmed_by_admin = true`).
* **Respuestas:**
  - `200 OK`: Retorna el pago actualizado.
  - `403 Forbidden`: Quien llama no es el organizador de la tanda (`NoEsOrganizadorError`).
  - `404 Not Found`: Si el pago no existe.
  - `422 Unprocessable Entity`: Si el pago ya fue confirmado previamente o fue rechazado.

> La confirmación de recepción por el ganador del turno no es parte del pago: se registra en la entrega del dinero (tabla `payout`, columnas `confirmed_by_admin` y `confirmed_by_recipient`), en el módulo de entregas (AP-07).

---

## ⚖ Reglas de Negocio del Dominio

1. **Métodos de Pago:**
   - `'efectivo'`: `cashAmount` debe ser igual a la cuota de la tanda. `transferAmount` debe ser `0`. El comprobante es opcional.
   - `'transferencia'`: `transferAmount` debe ser igual a la cuota. `cashAmount` debe ser `0`. El comprobante (`file`) es **obligatorio**.
   - `'hibrido'`: `cashAmount > 0` y `transferAmount > 0`, ambos con un máximo de 2 decimales y su suma exacta comparada en **centavos enteros** debe igualar la cuota. El comprobante (`file`) es **obligatorio**. Si la suma discrepa o los montos son inválidos, se rechaza con `HTTP 422 Unprocessable Entity` (AP-03).
2. **Ciclo de Vida y Estados del Pago:**
   - `PENDIENTE`: Estado inicial al registrar el pago (el participante ya confirmó; falta el organizador).
   - `CONFIRMADO`: Participante y organizador confirmaron. El pago está completado.
   - `RECHAZADO`: Comprobante fraudulento o discrepancia de fondos.
3. **Tolerancia OCR:**
   - Al comparar el monto detectado en la imagen bancaria contra `transferAmount`, se aplica una tolerancia de `±1.00 MXN` para admitir posibles variaciones de redondeo o comisión bancaria.

---

## 🤖 Instrucciones Críticas para Asistentes de IA y Desarrolladores

Cuando amplíes o modifiques este proyecto, **DEBES respetar rigurosamente estas directrices arquitectónicas**:

1. **Pureza de la Capa de Dominio (`src/<modulo>/domain`):**
   - NUNCA agregues dependencias de NestJS (`@Injectable`, `@Controller`, etc.), Fastify ni Drizzle dentro de `domain/`.
   - Si una regla de negocio falla, lanza una subclase de `DomainError` definida en `domain/errors/`.
   - Modifica el estado interno de la entidad a través de métodos de instancia ricos de la clase `Pago`, nunca mutando propiedades públicas directamente.
2. **Inversión de Dependencias (Puertos):**
   - La capa de aplicación (`application/services/`) NUNCA debe importar repositorios concretos (`drizzle-pago.repository.ts`). Siempre debe inyectar la interfaz del puerto mediante su Token (`@Inject(PAGO_REPOSITORY_PORT) private readonly repo: PagoRepositoryPort`).
3. **Persistencia y Adaptadores (`infrastructure/`):**
   - Todas las tablas de base de datos se configuran con Drizzle en `infrastructure/adapters/out/database/schema/`.
   - Usa siempre el archivo `mapper.ts` correspondiente para convertir filas crudas de base de datos (`PagoRow`) a entidades del dominio (`Pago`) y viceversa. Las filas crudas de SQL nunca deben traspasar la capa de infraestructura.
4. **Validación:**
   - La validación de payloads HTTP se realiza siempre con **Zod** en la capa de transporte (`Controller`) antes de invocar a los casos de uso.
5. **Comandos de Verificación:**
   - Tras cualquier cambio de código, debes verificar que compile y pase el linter sin errores ejecutando:
     ```bash
     npm run lint
     npm run build
     npm run test
     ```

---

## 🚂 Despliegue en Railway

El proyecto está configurado para desplegarse en [Railway](https://railway.com) mediante el archivo de manifiesto `railway.json`.

### Variables de Entorno Requeridas

Configura las siguientes variables en la sección **Variables** del servicio en Railway:

| Variable | Descripción | Ejemplo / Valor |
| :--- | :--- | :--- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL proporcionada por Railway | `${{Postgres.DATABASE_URL}}` |
| `DATABASE_SSL` | Habilita SSL en la conexión de base de datos (`false` para red interna privada, `true` para proxy público) | `false` |
| `PORT` | Puerto HTTP donde escuchará la aplicación (asignado automáticamente por Railway) | `3000` |
| `NODE_ENV` | Entorno de ejecución | `production` |
| `CORS_ORIGIN` | Orígenes permitidos (`*` para permitir cualquier origen) | `*` |
| `JWT_SECRET` | Clave secreta para firmar y validar tokens de autenticación JWT | `tu_clave_secreta_jwt` |

> **Nota sobre SSL en Railway:**
> - Si el backend y la base de datos están en el mismo proyecto de Railway y se comunican mediante la red interna (`postgres.railway.internal`), **no se requiere SSL** (`DATABASE_SSL=false`).
> - Si se conecta mediante el dominio público proxy de Railway o una base de datos externa gestionada, debe definirse `DATABASE_SSL=true`.

### Ciclo de Despliegue y Comandos

El archivo `railway.json` orquesta automáticamente el ciclo de vida del despliegue:
- **Build Command:** `npm run build` (compila la aplicación NestJS en `dist/`).
- **Pre-Deploy Command:** `npm run db:migrate` (aplica las migraciones pendientes de Drizzle ORM a PostgreSQL antes de que entre en servicio la nueva versión).
- **Start Command:** `npm run start:prod` (inicia el servidor de producción con `node dist/main.js`).
- **Healthcheck Path:** `/api/v1/health` (Railway sondea esta ruta para validar que el contenedor esté listo antes de dirigir el tráfico de red).

### Verificación del Health Check

Una vez desplegado el servicio, puedes verificar la disponibilidad del backend mediante HTTPS:

```bash
# En el entorno desplegado en Railway:
curl https://<tu-servicio>.up.railway.app/api/v1/health

# En entorno local:
curl http://localhost:3000/api/v1/health
```

**Respuesta esperada (HTTP 200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-10-11T07:45:00.000Z"
}
```

