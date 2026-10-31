# 💳 Módulo de Pagos — Tandea Back-End

Documentación técnica del módulo de **Pagos**, desarrollado bajo **Arquitectura Hexagonal (Puertos y Adaptadores)** y **Domain-Driven Design (DDD)** sobre NestJS, Fastify, Drizzle ORM y PostgreSQL.

---

## 🏛️ Arquitectura Hexagonal del Módulo

```text
src/pagos/
├── domain/                                  # 1. NÚCLEO: Dominio puro (agnóstico de NestJS/Drizzle/Vision)
│   ├── entities/
│   │   ├── Pago.ts                          # Entidad rica con reglas de doble confirmación y estados
│   │   └── pago.entity.ts                   # Exportación compatible
│   ├── factories/
│   │   └── pago.factory.ts                  # PagoFactory.crear(dto) según método
│   ├── errors/
│   │   └── pago.errors.ts                   # Jerarquía DomainError agnóstica de transporte
│   └── ports/
│       ├── in/
│       │   └── pago-use-cases.port.ts       # Contrato de casos de uso (PAGO_SERVICE_PORT)
│       └── out/
│           ├── pago-repository.port.ts      # Contrato de persistencia (PAGO_REPOSITORY_PORT)
│           ├── storage.port.ts              # Contrato de almacenamiento de comprobantes (STORAGE_PORT)
│           ├── evidence-repository.port.ts  # Contrato de evidencias (EVIDENCE_REPOSITORY_PORT)
│           ├── ocr-service.port.ts          # Contrato de verificación OCR (OCR_SERVICE_PORT)
│           └── pago-events.port.ts          # Contrato de eventos de dominio (PAGO_EVENTS_PORT)
├── application/                             # 2. APLICACIÓN: Orquestación
│   ├── dtos/
│   │   └── pago.dto.ts                      # Schemas Zod: zRegistrarPago, zRechazarPago, zPagoResponse
│   └── services/
│       └── pago.service.ts                  # Implementación de PagoUseCasesPort
├── infrastructure/                          # 3. INFRAESTRUCTURA: Adaptadores
│   └── adapters/
│       ├── in/http/                         # Adaptadores primarios (HTTP)
│       │   ├── controllers/
│       │   │   └── pago.controller.ts       # Endpoints REST (Fastify)
│       │   ├── filters/
│       │   │   └── pago-domain-exception.filter.ts # DomainError ➔ HTTP 403/404/409/422
│       │   └── multipart/
│       │       └── comprobante.file.ts      # Validación multipart (JPG, PNG, PDF ≤ 10 MB)
│       └── out/                             # Adaptadores secundarios
│           ├── database/                    # Persistencia con Drizzle ORM
│           │   ├── mappers/
│           │   │   └── pago.mapper.ts       # PaymentRow ↔ Pago Entity ↔ PagoResponseDto
│           │   ├── drizzle-pago.repository.ts
│           │   └── drizzle-evidence.repository.ts
│           ├── storage/
│           │   └── cloudinary.adapter.ts    # Almacenamiento en Cloudinary
│           ├── ocr/
│           │   ├── ocr-google-vision.adapter.ts # OCR con Google Cloud Vision API (AP-04)
│           │   └── ocr-mock.adapter.ts      # Mock para pruebas
│           └── events/
│               └── log-pago-events.adapter.ts # Publicador de eventos (pago.*)
└── pago.module.ts                           # Inyección de dependencias NestJS
```

---

## 🔍 1. Servicio OCR con Google Cloud Vision (`OcrGoogleVisionAdapter` — AP-04)

### Puerto de Salida (`OcrServicePort`)

Contrato puro de dominio definido en `src/pagos/domain/ports/out/ocr-service.port.ts`:

```typescript
export interface ResultadoOcr {
  montoDetectado: number | null;
  coincide: boolean;
}

export interface OcrServicePort {
  verificarMonto(imagen: Buffer, montoEsperado: number): Promise<ResultadoOcr>;
}
```

### Adaptador de Infraestructura (`OcrGoogleVisionAdapter`)

Implementado en `src/pagos/infrastructure/adapters/out/ocr/ocr-google-vision.adapter.ts`:

1. **Extracción de Texto**: Invoca Google Cloud Vision mediante `textDetection` procesando imágenes en JPG, PNG o PDF.
2. **Detección de Importes**: Utiliza una combinación de expresiones regulares para identificar:
   - Patrones contextuales: palabras clave bancarias (`monto`, `importe`, `cantidad`, `total`, `transferido`, `spei`).
   - Patrones con símbolo monetario: `$1,250.00`, `$ 500`, `MXN 1,000.00`.
   - Números con separadores de miles y decimales: `1,250.50` o sin miles `1250.50`.
   - Filtrado de falsos positivos: descarta fechas (`27/10/2026`, `2026-10-27`), horas (`14:30:52`), folios largos y números de cuenta.
3. **Normalización Monetaria Segura**: Convierte los montos a **centavos enteros** (`Math.round(valor * 100)`) evitando errores de precisión por punto flotante.
4. **Regla de Tolerancia**: Aplica una tolerancia estricta de **$\pm 1.00$ MXN** ($\pm 100$ centavos) contra el monto esperado.
5. **Pagos Híbridos**: Compara contra `montoTransferencia`, no contra el total del pago.
6. **Resiliencia ante Errores**:
   - Imágenes sin texto o comprobantes ilegibles retornan `{ montoDetectado: null, coincide: false }`.
   - Errores de conexión o fallos de la API de Google Vision se capturan, se registran en el log y retornan `{ montoDetectado: null, coincide: false }`.
   - El fallo del OCR **nunca bloquea el registro del pago**: el pago se persiste con `ocrVerified: false` para revisión manual del organizador.

### Configuración de Credenciales de Google Cloud Vision

Configura una de las siguientes opciones en `.env`:

* **Opción A (Recomendada en producción/contenedores):**
  ```env
  GOOGLE_APPLICATION_CREDENTIALS=/ruta/segura/a/credenciales-service-account.json
  ```
* **Opción B (Para despliegues PaaS tipo Railway):**
  ```env
  GOOGLE_VISION_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
  ```

> [!CAUTION]
> **Nunca incluyas credenciales, tokens ni claves JSON en el código fuente, repositorio de Git ni commits.**

---

## 📋 2. Endpoints de Confirmación y Rechazo por Organizador (AP-05)

### Autorización y Reglas de Negocio

* Solo el **organizador de la tanda** (`tanda.id_admin`) o un **administrador global** (`role === 'admin_global'`) pueden confirmar o rechazar un pago.
* Usuario no autenticado: `401 Unauthorized`.
* Usuario autenticado sin permisos sobre la tanda: `403 Forbidden` (`UsuarioNoAutorizadoError`).
* Pago inexistente: `404 Not Found` (`PagoNotFoundError`).
* Pago ya confirmado o transición inválida: `422 Unprocessable Entity` (`PagoYaConfirmadoError`, `ConfirmacionOrganizadorPreviaError`, `PagoRechazadoError`).

---

### Endpoint 1: Confirmar Pago por el Organizador

* **Método:** `PATCH`
* **Ruta:** `/api/v1/pagos/:id/confirmar`
* **Cabecera requerida:** `Authorization: Bearer <token_jwt>`
* **Descripción:** El organizador o administrador global valida que recibió los fondos (en efectivo o vía transferencia).

#### Flujo de Ejecución:
1. Valida la autenticación mediante `JwtAuthGuard`.
2. Recupera la entidad `Pago` y la tanda vinculada.
3. Verifica que el usuario sea el organizador (`idAdmin`) o administrador global.
4. Ejecuta el método de dominio `pago.confirmarPorOrganizador()`.
5. Actualiza `confirmedByAdmin = true` y transiciona el estado según las reglas de doble confirmación.
6. Persiste los cambios mediante `PagoRepositoryPort.update()`.
7. Emite el evento de dominio `pago.confirmado`.
8. Retorna la respuesta `PagoResponseDto`.

#### Respuesta `200 OK`:
```json
{
  "idPayment": 15,
  "idNumber": 3,
  "metodoPago": "transferencia",
  "transferAmount": 1000,
  "cashAmount": 0,
  "totalAmount": 1000,
  "status": "CONFIRMADO",
  "confirmedByParticipant": true,
  "confirmedByAdmin": true,
  "ocrVerified": true,
  "ocrDetectedAmount": 1000,
  "evidenceUrl": "https://res.cloudinary.com/.../comprobante.jpg",
  "rejectionReason": null,
  "createdAt": "2026-10-20T10:00:00.000Z",
  "updatedAt": "2026-10-27T14:40:00.000Z"
}
```

---

### Endpoint 2: Rechazar Pago por el Organizador

* **Método:** `PATCH`
* **Ruta:** `/api/v1/pagos/:id/rechazar`
* **Cabecera requerida:** `Authorization: Bearer <token_jwt>`
* **Content-Type:** `application/json`

#### Cuerpo de la Petición (`zRechazarPago`):
```json
{
  "motivo": "El comprobante no corresponde a la cuenta de la tanda ni muestra clave de rastreo válida."
}
```

* **Validaciones de Zod**:
  - `motivo` es obligatorio, tipo string, con espacios iniciales/finales removidos (`trim`).
  - Longitud mínima: **5 caracteres**.
  - Longitud máxima: **500 caracteres**.

#### Flujo de Ejecución:
1. Valida el JWT y el cuerpo JSON con Zod.
2. Verifica permisos del organizador/admin sobre la tanda.
3. Invoca `pago.rechazar(motivo)` en la entidad de dominio.
4. Si el pago ya estaba completamente confirmado, lanza `PagoYaConfirmadoError` (`HTTP 422`).
5. Persiste el estado `status = 'RECHAZADO'` y el motivo en la columna `rejection_reason`.
6. Emite el evento de dominio `pago.rechazado`.
7. Retorna `PagoResponseDto`.

#### Respuesta `200 OK`:
```json
{
  "idPayment": 15,
  "idNumber": 3,
  "metodoPago": "transferencia",
  "transferAmount": 1000,
  "cashAmount": 0,
  "totalAmount": 1000,
  "status": "RECHAZADO",
  "confirmedByParticipant": true,
  "confirmedByAdmin": false,
  "ocrVerified": false,
  "ocrDetectedAmount": null,
  "evidenceUrl": "https://res.cloudinary.com/.../comprobante.jpg",
  "rejectionReason": "El comprobante no corresponde a la cuenta de la tanda ni muestra clave de rastreo válida.",
  "createdAt": "2026-10-20T10:00:00.000Z",
  "updatedAt": "2026-10-27T14:42:00.000Z"
}
```

---

## 🗄️ 3. Persistencia y Migraciones (Drizzle ORM)

La columna persistente `rejection_reason` fue agregada a la tabla `payment` en `src/database/tandea.schema.ts`:

```typescript
export const paymentTable = pgTable('payment', {
  // ...
  rejectionReason: text('rejection_reason'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
```

Migración generada con Drizzle Kit en `drizzle/migrations/0002_small_sumo.sql`:
```sql
ALTER TABLE "payment" ADD COLUMN "rejection_reason" text;
```

---

## 📣 4. Eventos de Dominio Emitidos (`PagoEventsPort`)

| Evento | Payload | Cuándo se emite |
| :--- | :--- | :--- |
| `pago.registrado` | `{ paymentId, tandaId, userId }` | Al crear un pago (`POST /pagos`). |
| `pago.confirmado` | `{ paymentId, tandaId, confirmedByAdmin }` | Al confirmar el organizador (`PATCH /pagos/:id/confirmar`). |
| `pago.rechazado` | `{ paymentId, tandaId, motivo }` | Al rechazar el organizador (`PATCH /pagos/:id/rechazar`). |

---

## 🧪 5. Pruebas Automatizadas

Se cuenta con suites completas de pruebas unitarias y de integración sobre Fastify:

```bash
# Ejecutar todas las pruebas del proyecto
npm run test

# Pruebas específicas del adaptador OCR de Google Vision
npx vitest run test/ocr-google-vision-adapter.spec.ts

# Pruebas de confirmación y rechazo HTTP (Fastify real + Zod + Auth)
npx vitest run test/pago-confirmacion-rechazo.spec.ts

# Pruebas del servicio de aplicación de pagos
npx vitest run src/pagos/application/services/pago.service.spec.ts
```

### Casos Cubiertos en Pruebas OCR:
- Monto detectado exactamente igual al esperado.
- Monto dentro de la tolerancia de $\pm 1.00$ MXN ($+1.00$, $-1.00$, $+0.50$).
- Monto fuera de la tolerancia ($+1.01$, $-1.01$, importes discrepantes).
- Formatos con separadores de miles, decimales, espacios y símbolo `$`.
- Descarte de números de folio, referencias, fechas y horas.
- Comparación contra `montoTransferencia` en pagos híbridos.
- Manejo de comprobantes sin texto o imágenes ilegibles.
- Manejo de errores de conexión o autenticación del proveedor externo.

### Casos Cubiertos en Confirmación y Rechazo:
- Confirmación exitosa por el organizador (`confirmedByAdmin = true`, emisión de evento).
- Confirmación por administrador global.
- Rechazo exitoso con motivo válido (5 a 500 caracteres, persistencia de `rejectionReason`).
- Códigos HTTP: `401` sin token, `403` usuario no autorizado, `404` pago inexistente.
- Validación Zod del motivo (`422` si es menor a 5 caracteres, mayor a 500 o ausente).
- Protección contra doble confirmación o confirmación de pago ya rechazado (`422`).
- Prohibición de rechazar pagos ya confirmados (`422`).

---

## ⚠️ 6. Limitaciones y Consideraciones Externas

1. **Cuotas y API de Google Cloud Vision**: Requiere habilitar la API de Cloud Vision en la consola de Google Cloud y disponer de cuota activa. En ausencia de credenciales válidas en desarrollo local, el sistema no colapsa y registra una advertencia en el log, permitiendo la revisión manual por parte del organizador.
2. **Formatos Soportados**: Google Cloud Vision procesa imágenes JPG, PNG, GIF, BMP, WEBP, RAW, ICO, PDF y TIFF. El controlador restringe la subida a JPG, PNG y PDF con un máximo de 10 MB.
3. **Comprobantes Manuscritos**: Comprobantes con caligrafía manual pueden presentar menor porcentaje de acierto; en tales casos `coincide: false` delega la validación final al organizador.
