# Plan de Implementación Integral: Registrar Pago (AP-03)
## `SP-2-[FE-PAGO] Pantalla Registrar pago con selector de método`
## `SP-2-[BE-PAGO] Endpoint POST /api/v1/pagos`

Este documento describe la arquitectura técnica, contratos de comunicación y guía de desarrollo paso a paso para implementar la funcionalidad completa de registro de pagos en **Backend** (`Tandea-Back-End`) y **Frontend** (`Tandea-Front-End`).

---

## 1. Contrato de Integración HTTP (API Contract)

### `POST /api/v1/pagos`
* **Encabezados**:
  * `Authorization: Bearer <jwt_token>`
  * `Content-Type: application/json`

* **Request Body (JSON)**:
```json
{
  "idNumber": 10,
  "metodoPago": "hibrido",
  "transferAmount": 600.00,
  "cashAmount": 400.00,
  "fileUrl": "https://storage.googleapis.com/tandea-evidence/comprobante-10.jpg"
}
```

* **Validaciones del Contrato**:
  * `idNumber`: Entero positivo correspondiente al turno/número del usuario.
  * `metodoPago`: Enum `'efectivo' | 'transferencia' | 'hibrido'`.
  * `transferAmount`: Número decimal $\ge 0$. Si el método es `'efectivo'`, debe ser `0`. Si es `'transferencia'`, debe ser igual a la cuota. Si es `'hibrido'`, debe ser $> 0$.
  * `cashAmount`: Número decimal $\ge 0$. Si el método es `'transferencia'`, debe ser `0`. Si es `'efectivo'`, debe ser igual a la cuota. Si es `'hibrido'`, debe ser $> 0$.
  * `fileUrl`: Obligatorio si `transferAmount > 0` (URL válida). Opcional si el pago es 100% efectivo.
  * **Invariante financiera**: $\text{transferAmount} + \text{cashAmount} == \text{tanda.contributionAmount}$.

* **Response Success (201 Created)**:
```json
{
  "idPayment": 45,
  "idNumber": 10,
  "transferAmount": 600.00,
  "cashAmount": 400.00,
  "totalAmount": 1000.00,
  "status": "PENDIENTE",
  "confirmedByParticipant": true,
  "confirmedByAdmin": false,
  "evidenceUrl": "https://storage.googleapis.com/tandea-evidence/comprobante-10.jpg",
  "createdAt": "2026-10-22T10:30:00.000Z"
}
```

---

## 2. Implementación en Backend (`Tandea-Back-End`)

### Paso 2.1 — Alinear Dominio de Pagos con el Esquema Real de Base de Datos
* **Archivos a intervenir**:
  * `src/pagos/domain/entities/pago.entity.ts`:
    * Actualizar tipos de datos para usar `idPayment?: number`, `idNumber: number`, `transferAmount: number`, `cashAmount: number`, `totalAmount: number`, `status: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO'`.
  * `src/pagos/domain/factories/pago.factory.ts`:
    * Implementar `PagoFactory.crear(...)` que reciba el método (`efectivo`, `transferencia`, `hibrido`), valide los montos contra la cuota requerida de la tanda y devuelva la instancia de `Pago`.

### Paso 2.2 — Adaptador de Persistencia Drizzle
* **Archivo**: `src/pagos/infrastructure/adapters/out/database/drizzle-pago.repository.ts`
  * Sustituir la tabla temporal `pagosTable` por la tabla definitiva [`paymentTable`](../src/database/tandea.schema.ts#L205) y [`evidenceTable`](../src/database/tandea.schema.ts#L270).
  * En una transacción Drizzle (`db.transaction`):
    1. Insertar el pago en `paymentTable` con `confirmedByParticipant = true`.
    2. Si existe `fileUrl`, insertar la fila en `evidenceTable` vinculada al `id_payment`.

### Paso 2.3 — Registrar `PagoModule` en `AppModule`
* **Archivo**: `src/app.module.ts`
  * Importar `PagoModule` para que NestJS exponga la ruta `/api/v1/pagos` protegida por `JwtAuthGuard`.

---

## 3. Implementación en Frontend (`Tandea-Front-End`)

### Paso 3.1 — Pantalla `RegistrarPagoScreen`
* **Ubicación**: `lib/features/pagos/presentation/screens/registrar_pago_screen.dart`
* **Parámetros recibidos**:
  * `idNumber` (`int`): ID del turno asignado.
  * `cuota` (`double`): Monto exacto requerido para el pago.
  * `nombreTanda` (`String`): Nombre informativo para el encabezado.
* **Componentes de la Pantalla**:
  1. **Tarjeta Resumen de Cuota**:
     * Muestra la cuota a cubrir (ej. `$1,000.00 MXN`) con estilo destacado.
  2. **Selector de Método de Pago (`SegmentedButton` / Pestañas)**:
     * Opciones: `Efectivo`, `Transferencia`, `Híbrido`.
  3. **Campos de Entrada de Monto**:
     * Si `Efectivo`: Campo de monto fijo bloqueado o prellenado con la cuota total.
     * Si `Transferencia`: Campo de monto por transferencia bloqueado al total y selector de comprobante.
     * Si `Híbrido`: Dos campos editables (`Efectivo` y `Transferencia`) con cálculo dinámico del remanente.
  4. **Área de Comprobante de Pago**:
     * Visible cuando el método es Transferencia o Híbrido.
     * Botón para adjuntar foto/captura de pantalla o ingresar enlace de comprobante.
  5. **Botón Principal Reutilizable (`PrimaryButton`)**:
     * Utiliza `lib/core/widgets/primary_button.dart`.
     * **Estado reactivo**: El botón se deshabilita si:
       * En pago híbrido: $\text{montoTransferencia} + \text{montoEfectivo} \neq \text{cuota}$.
       * En transferencia o híbrido: No se ha adjuntado comprobante.
     * Al presionar, ejecuta `PagoProvider.registrarPago(...)`.

### Paso 3.2 — Integración con GoRouter (`lib/core/routes/app_router.dart`)
* Registrar la ruta:
  ```dart
  GoRoute(
    path: '/pagos/registrar',
    builder: (context, state) {
      final extra = state.extra as Map<String, dynamic>;
      return RegistrarPagoScreen(
        idNumber: extra['idNumber'] as int,
        cuota: extra['cuota'] as double,
        nombreTanda: extra['nombreTanda'] as String,
      );
    },
  )
  ```

### Paso 3.3 — Enlace desde "Mis Tandas"
* En `TandaCardItem`, cuando el turno del participante tenga estado de pago pendiente, mostrar el botón secundario "Registrar pago" que navegue hacia `/pagos/registrar`.
