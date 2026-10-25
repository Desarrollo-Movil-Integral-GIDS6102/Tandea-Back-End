# Módulo de Pagos — Tandea (Documentación Técnica y Flujo AP-03)

El módulo de Pagos es el núcleo transaccional de Tandea. Permite a los participantes abonar sus cuotas mediante tres modalidades (Efectivo, Transferencia o Híbrido), respaldar el pago con comprobantes digitales y someter la transacción a doble confirmación (Participante y Organizador) con validación OCR automatizada.

---

## 📐 Reglas de Negocio Financieras (Historia AP-03)

1. **Métodos de Pago Permitidos**:
   * **Efectivo (`efectivo`)**: El participante entrega el dinero en físico al organizador. `montoEfectivo == cuota`, `montoTransferencia == 0`. No requiere comprobante obligatorio.
   * **Transferencia (`transferencia`)**: El participante deposita vía SPEI/banco. `montoTransferencia == cuota`, `montoEfectivo == 0`. **Requiere comprobante digital obligatorio (`comprobanteUrl` / `fileUrl`)**.
   * **Híbrido (`hibrido`)**: El participante paga una parte en físico y el resto por transferencia.
2. **Invariante de Pago Híbrido**:
   $$\text{montoTransferencia} + \text{montoEfectivo} = \text{totalAmount} = \text{cuota de la tanda}$$
   Ambos parciales deben ser mayores estrictos a cero ($\text{transferencia} > 0 \land \text{efectivo} > 0$).
3. **Flujo de Estados del Pago**:
   * `PENDIENTE`: Registrado por el participante, esperando confirmación.
   * `CONFIRMADO`: Aprobado por el organizador tras verificar la recepción del dinero.
   * `RECHAZADO`: Declinado por el organizador por fondos no recibidos o comprobante inválido.

---

## 🏛️ Estructura en el Backend (`Tandea-Back-End`)

* **Tablas de Base de Datos** ([`src/database/tandea.schema.ts`](../Tandea-Back-End/src/database/tandea.schema.ts)):
  * **`paymentTable`**: Almacena `id_payment`, `id_number`, `transfer_amount`, `cash_amount`, `total_amount`, `confirmed_by_participant`, `confirmed_by_admin`, `status`.
  * **`evidenceTable`**: Almacena `id_evidence`, `id_payment`, `id_payout`, `file_url`.
* **Endpoint Principal**:
  * **`POST /api/v1/pagos`**:
    * Body JSON:
      ```json
      {
        "idNumber": 12,
        "metodoPago": "hibrido",
        "transferAmount": 500.00,
        "cashAmount": 500.00,
        "fileUrl": "https://res.cloudinary.com/.../comprobante.jpg"
      }
      ```
    * Respuestas:
      * `201 Created`: Pago registrado con éxito.
      * `400 Bad Request`: Si la suma de montos no coincide con la cuota de la tanda o falta comprobante para transferencia.
      * `404 Not Found`: Si el número o turno no existe.
      * `409 Conflict`: Si ya existe un pago confirmado para esa ronda o el número no corresponde al usuario autenticado.

---

## 📱 Estructura en el Frontend (`Tandea-Front-End`)

* **Capa Domain**:
  * [`PagoEntity`](../Tandea-Front-End/lib/features/pagos/domain/entities/pago_entity.dart): Entidad inmutable con montos, método, estado y comprobante.
  * [`PagoRepository`](../Tandea-Front-End/lib/features/pagos/domain/repositories/pago_repository.dart): Contrato del repositorio para `registrarPago(PagoEntity pago)`.
* **Capa Data**:
  * `PagoRemoteDataSource`: Implementación HTTP con `ApiClient` (Dio).
  * `PagoRepositoryImpl`: Mapea excepciones de red a `Failures` de dominio.
* **Capa Presentation**:
  * `PagoProvider`: Administra el estado de carga (`isLoading`), errores y éxito del registro de pagos.
  * **`RegistrarPagoScreen`** (`lib/features/pagos/presentation/screens/registrar_pago_screen.dart`):
    * Selector interactivo de método (`SegmentedButton` o pestañas: Efectivo / Transferencia / Híbrido).
    * Desglose dinámico de campos según el método seleccionado.
    * Validación en tiempo real de la suma híbrida.
    * Área de subida/captura de comprobante.
    * Botón de acción reutilizable `PrimaryButton` (deshabilitado hasta cumplir la cuota exacta).
