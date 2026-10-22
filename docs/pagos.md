# 💳 Módulo de Pagos — Entidad de Dominio y Fábrica (Pago & PagoFactory)

Documentación técnica de la entidad de dominio **`Pago`** y la fábrica de negocio **`PagoFactory`** del núcleo de **Tandea Back-End**, siguiendo los principios de **Arquitectura Hexagonal (Puertos y Adaptadores)** y **Domain-Driven Design (DDD)** sin dependencias del framework NestJS ni ORMs en la capa de dominio.

---

## 🏛️ Arquitectura del Dominio

El dominio de pagos encapsula todas las reglas e invariantes financieras requeridas para el registro, verificación y doble confirmación de aportaciones a tandas:

```
src/pagos/domain/
├── entities/
│   ├── Pago.ts                     # Entidad de dominio pura (invariantes y transiciones)
│   └── pago.entity.ts              # Exportación compatible
├── factories/
│   ├── pago.factory.ts             # PagoFactory.crear(dto) según método
│   └── PagoFactory.ts              # Alias PascalCase
├── errors/
│   └── pago.errors.ts              # Errores de dominio puros (DomainError)
└── ports/
    ├── in/
    │   └── pago-use-cases.port.ts  # Casos de uso de entrada
    └── out/
        └── pago-repository.port.ts # Contrato de persistencia de salida
```

---

## 📦 1. Entidad `Pago`

La clase [`Pago`](../src/pagos/domain/entities/Pago.ts) representa una aportación financiera vinculada a un turno de tanda (`idNumber`).

### Propiedades Principales

| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `idPayment` | `number \| undefined` | Identificador autoincremental de base de datos. |
| `idNumber` | `number` | Identificador del turno/número de tanda asociado. |
| `transferAmount` | `number` | Monto aportado mediante transferencia bancaria (SPEI). |
| `cashAmount` | `number` | Monto aportado en dinero en efectivo físico. |
| `totalAmount` | `number` | Monto total de la cuota (`transferAmount + cashAmount`). |
| `metodoPago` | `'efectivo' \| 'transferencia' \| 'hibrido'` | Modalidad de pago seleccionada. |
| `status` | `'PENDIENTE' \| 'CONFIRMADO' \| 'RECHAZADO'` | Estado general del pago en el ciclo de vida. |
| `confirmedByParticipant` | `boolean` | `true` cuando el participante declara haber pagado. |
| `confirmedByAdmin` | `boolean` | `true` cuando el organizador/admin valida los fondos. |
| `evidenceUrl` | `string \| null` | URL de la imagen o PDF del comprobante de transferencia. |
| `ocrDetectedAmount` | `number \| null` | Monto leído automáticamente por el servicio OCR. |
| `ocrVerified` | `boolean` | Si el comprobante superó la validación OCR (±1 peso). |

### Métodos de Negocio Expuestos

#### `confirmarPorParticipante(): void`
Registra la confirmación y declaración de pago por parte del participante.
- Marca `confirmedByParticipant = true`.
- Actualiza `updatedAt`.
- Si el administrador ya había confirmado previamente (`confirmedByAdmin === true`), transiciona el estado automáticamente a `'CONFIRMADO'`.
- **Excepciones**:
  - Lanza `PagoRechazadoError` si el pago está rechazado.
  - Lanza `PagoYaConfirmadoError` si el pago ya estaba completamente confirmado.
  - Lanza `ConfirmacionParticipantePreviaError` si el participante ya lo había confirmado previamente.

#### `confirmarPorAdmin(): void`
Registra la verificación y recepción de fondos por parte del organizador/administrador.
- Marca `confirmedByAdmin = true`.
- Actualiza `confirmadoOrganizadorEn` y `updatedAt`.
- Si el participante ya había confirmado (`confirmedByParticipant === true`), transiciona el estado a `'CONFIRMADO'`.
- **Excepciones**:
  - Lanza `PagoRechazadoError` si el pago está rechazado.
  - Lanza `PagoYaConfirmadoError` si el pago ya estaba completamente confirmado.
  - Lanza `ConfirmacionAdminPreviaError` si el admin ya lo había confirmado previamente.

#### `estaConfirmado(): boolean`
Determina si el pago ha completado el flujo de doble confirmación.
- Retorna `true` si y solo si:
  $$(confirmedByParticipant \land confirmedByAdmin) \lor status == \text{'CONFIRMADO'}$$
- Retorna `false` si falta la confirmación de cualquiera de las dos partes.

---

## 🏭 2. Fábrica `PagoFactory`

La clase [`PagoFactory`](../src/pagos/domain/factories/pago.factory.ts) expone el método estático `crear(dto)` para construir de forma segura e inmutable una entidad `Pago` según el método de pago seleccionado.

### Contrato de Entrada (`CrearPagoFactoryDto`)
```typescript
interface CrearPagoFactoryDto {
  idPayment?: number;
  idNumber: number;
  metodoPago: 'efectivo' | 'transferencia' | 'hibrido';
  totalAmount?: number;
  transferAmount?: number;
  cashAmount?: number;
  evidenceUrl?: string | null;
  confirmedByParticipant?: boolean;
  confirmedByAdmin?: boolean;
}
```

### Reglas por Método de Pago

### 1. Efectivo (`efectivo`)
* El monto aportado se asigna íntegramente a `cashAmount`.
* `transferAmount` debe ser estrictamente `0`. Lanza error si se envía monto por transferencia.
* Comprobante digital (`evidenceUrl`) es **opcional**.
* Invariante: `cashAmount == totalAmount`.

### 2. Transferencia (`transferencia`)
* El monto aportado se asigna íntegramente a `transferAmount`.
* `cashAmount` debe ser estrictamente `0`. Lanza error si se envía monto en efectivo.
* Comprobante digital (`evidenceUrl`) es **obligatorio**. Lanza `ReglaNegocioPagoError` si no se adjunta.
* Invariante: `transferAmount == totalAmount`.

### 3. Híbrido (`hibrido`)
* Requiere aportación parcial tanto en efectivo como en transferencia:
  $$\text{transferAmount} > 0 \quad\land\quad \text{cashAmount} > 0$$
* Comprobante digital (`evidenceUrl`) es **obligatorio** para validar la fracción transferida vía SPEI.
* Invariante financiera:
  $$\text{transferAmount} + \text{cashAmount} == \text{totalAmount}$$
  Si la suma no coincide exactamente con la cuota total (tolerancia decimal de 2 dígitos), se lanza `ReglaNegocioPagoError`.

---


## ☁️ 3. Almacenamiento de Comprobantes (`StoragePort` & `CloudinaryAdapter`)

El almacenamiento de comprobantes digitales se realiza mediante el puerto [`StoragePort`](../src/pagos/domain/ports/out/storage.port.ts) desacoplado de la infraestructura.

### Características del Adaptador [`CloudinaryAdapter`](../src/pagos/infrastructure/adapters/out/storage/cloudinary.adapter.ts):
* **Carpeta de destino**: Guarda los archivos obligatoriamente en la carpeta `comprobantes/`.
* **Compresión previa**: Aplica optimizaciones de peso y calidad automáticas de Cloudinary:
  ```typescript
  transformation: [
    { quality: 'auto:good' },
    { fetch_format: 'auto' },
    { width: 2048, crop: 'limit' },
  ]
  ```
* **Variables de entorno**: Las credenciales se configuran de forma segura en `.env`:
  * `CLOUDINARY_CLOUD_NAME`
  * `CLOUDINARY_API_KEY`
  * `CLOUDINARY_API_SECRET`
* **Persistencia en Base de Datos**: La URL segura resultante se persiste en `evidence.file_url` vinculada a `id_payment` a través de [`DrizzleEvidenceRepository`](../src/pagos/infrastructure/adapters/out/database/drizzle-evidence.repository.ts), respetando el constraint `evidence_exactly_one_parent_chk`.

---

## 🧪 4. Guía de Pruebas

El módulo cuenta con cobertura total de pruebas unitarias y de integración con Vitest sin necesidad de levantar servicios de base de datos ni contenedor de NestJS.


### Ejecutar Todas las Pruebas
```bash
npm test
```


### Ejecutar Pruebas Específicas de Pagos, Fábrica y Almacenamiento
```bash
npx vitest run src/pagos/domain/entities/pago.entity.spec.ts
npx vitest run src/pagos/domain/factories/pago.factory.spec.ts
npx vitest run test/cloudinary-adapter.spec.ts
npx vitest run test/evidence-storage-integration.spec.ts
> develop
```

### Ejecutar en Modo Watch (Desarrollo Interactivo)
```bash
npm run test:watch
```

### Casos de Prueba Verificados
1. **Entidad `Pago`**:
   - Creación pura sin dependencias de NestJS.
   - Estado inicial `PENDIENTE` y `estaConfirmado() === false`.
   - `confirmarPorParticipante()` marca participante y mantiene `estaConfirmado() === false` hasta la confirmación del admin.
   - `confirmarPorAdmin()` marca admin y transiciona a `CONFIRMADO` cuando ambos confirman.
   - Rechazo de confirmaciones duplicadas (`ConfirmacionParticipantePreviaError`, `ConfirmacionAdminPreviaError`).
   - Bloqueo de confirmaciones en pagos rechazados (`PagoRechazadoError`).
   - Validación OCR con tolerancia de $\pm 1$ peso.
2. **`PagoFactory`**:
   - Construcción de pago en efectivo con comprobante opcional.
   - Prohibición de montos de transferencia en pagos en efectivo.
   - Construcción de pago por transferencia exigiendo comprobante digital.
   - Prohibición de pagos por transferencia sin comprobante.
   - Construcción de pago híbrido con verificación de sumas exactas.
   - Validación de `idNumber` entero positivo y rechazo de métodos desconocidos.

3. **`CloudinaryAdapter` & `Evidence`**:
   - Subida a carpeta `comprobantes/` con compresión previa de peso/formato.
   - Lectura de credenciales desde variables de entorno.
   - Guardado de la URL segura en `evidence.file_url` vinculado a `idPayment`.


