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
8. [Especificación de la API (Endpoints)](#-especificación-de-la-api-endpoints)
9. [Reglas de Negocio del Dominio](#-reglas-de-negocio-del-dominio)
10. [Instrucciones Críticas para Asistentes de IA y Desarrolladores](#-instrucciones-críticas-para-asistentes-de-ia-y-desarrolladores)

---

## 🎯 Visión General y Propósito

Tandea digitaliza la gestión de tandas tradicionales:
* **Gestión de rondas y participantes:** Asignación de turnos y números de pago.
* **Control de pagos multicanal:** Pagos en efectivo, por transferencia o híbridos.
* **Flujo de doble confirmación:** Garantía de entrega donde primero confirma el **organizador** y posteriormente confirma el **receptor** (ganador del turno).
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
   - Las entidades encapsulan estado y métodos de negocio (`confirmarPorOrganizador()`, `confirmarPorReceptor()`, etc.).
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

# Base de Datos (Drizzle Kit)
npm run db:push        # Sincroniza esquemas directamente a PostgreSQL (útil en dev)
npm run db:generate    # Genera archivos SQL de migración basados en los schemas
npm run db:migrate     # Ejecuta las migraciones pendientes en PostgreSQL
npm run db:studio      # Abre la interfaz visual de Drizzle Studio en el navegador
```

---

## 📡 Especificación de la API (Endpoints)

Todas las rutas tienen el prefijo global: **`/api/v1`**.

### Módulo: Pagos (`/api/v1/pagos`)

#### 1. Registrar Pago
* **Método:** `POST`
* **Ruta:** `/api/v1/pagos`
* **Estado Exitoso:** `201 Created`
* **Cuerpo de la Petición (`Content-Type: application/json`):**
```json
{
  "tandaId": "d3b07384-d113-4e89-a5e2-636a2829ec37",
  "participanteId": "a2c145e8-5b43-4217-bf39-847291a1829e",
  "numeroPago": 1,
  "monto": 1000.00,
  "montoEfectivo": 400.00,
  "montoTransferencia": 600.00,
  "metodoPago": "hibrido",
  "comprobanteUrl": "https://storage.tandea.app/comprobantes/pago_1.jpg",
  "fechaPago": "2026-10-05T16:00:00.000Z"
}
```
* **Respuesta (`201 Created`):**
```json
{
  "id": "78b4081c-811c-43f1-b847-f3c1bc91703d",
  "tandaId": "d3b07384-d113-4e89-a5e2-636a2829ec37",
  "participanteId": "a2c145e8-5b43-4217-bf39-847291a1829e",
  "numeroPago": 1,
  "monto": 1000,
  "montoEfectivo": 400,
  "montoTransferencia": 600,
  "metodoPago": "hibrido",
  "estado": "pendiente",
  "comprobanteUrl": "https://storage.tandea.app/comprobantes/pago_1.jpg",
  "montoOcrValidado": null,
  "ocrAprobado": null,
  "confirmadoOrganizadorEn": null,
  "confirmadoReceptorEn": null,
  "fechaPago": "2026-10-05T16:00:00.000Z",
  "createdAt": "2026-10-05T16:20:00.000Z",
  "updatedAt": "2026-10-05T16:20:00.000Z"
}
```

#### 2. Obtener Pago por ID
* **Método:** `GET`
* **Ruta:** `/api/v1/pagos/:id`
* **Parámetros:** `:id` (UUID)
* **Respuestas:**
  - `200 OK`: Retorna el objeto `PagoResponseDto`.
  - `404 Not Found`: Si el pago no existe (`PagoNotFoundError`).

#### 3. Confirmación del Organizador (1ra Confirmación)
* **Método:** `PATCH`
* **Ruta:** `/api/v1/pagos/:id/confirmar-organizador`
* **Descripción:** El organizador valida que recibió el pago en efectivo o verificó la transferencia.
* **Transición de Estado:** Pasa de `pendiente` a `confirmado_parcial`.
* **Respuestas:**
  - `200 OK`: Retorna el pago actualizado.
  - `422 Unprocessable Entity`: Si el pago ya fue confirmado previamente o ya está completamente cerrado.

#### 4. Confirmación del Receptor (2da Confirmación)
* **Método:** `PATCH`
* **Ruta:** `/api/v1/pagos/:id/confirmar-receptor`
* **Descripción:** El receptor (ganador de la tanda) confirma la recepción del dinero.
* **Transición de Estado:** Pasa a `confirmado`.
* **Regla estricta:** El organizador **debe haber confirmado primero**. De lo contrario retorna `422 Unprocessable Entity`.

---

## ⚖ Reglas de Negocio del Dominio

1. **Métodos de Pago:**
   - `'efectivo'`: `montoEfectivo` debe ser igual a `monto`. `montoTransferencia` debe ser `0`.
   - `'transferencia'`: `montoTransferencia` debe ser igual a `monto`. `montoEfectivo` debe ser `0`. `comprobanteUrl` es **obligatorio**.
   - `'hibrido'`: `montoEfectivo > 0` y `montoTransferencia > 0`, y su suma exacta debe igualar a `monto`. `comprobanteUrl` es **obligatorio**.
2. **Ciclo de Vida y Estados del Pago:**
   - `pendiente`: Estado inicial al registrar el pago.
   - `confirmado_parcial`: El organizador confirmó la recepción del aporte.
   - `confirmado`: Ambos (organizador y receptor) confirmaron. El pago está completado y liquidado.
   - `rechazado`: Comprobante fraudulento o discrepancia de fondos.
3. **Tolerancia OCR:**
   - Al comparar el monto detectado en la imagen bancaria contra `montoTransferencia`, se aplica una tolerancia de `±1.00 MXN` para admitir posibles variaciones de redondeo o comisión bancaria.

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
