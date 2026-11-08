# 💸 Módulo de Entregas — Tandea Back-End

Entrega del dinero de cada turno con **doble confirmación** (AP-07): el organizador la registra con una foto de evidencia y el dueño del número confirma que la recibió, lo que cierra el turno.

## 🏛️ Arquitectura Hexagonal

| Pieza | Archivo |
| :--- | :--- |
| Entrada HTTP | `infrastructure/adapters/in/http/entrega.controller.ts` |
| Caso de uso | `application/services/entrega.service.ts` (`ENTREGA_USE_CASES_PORT`) |
| Persistencia | `infrastructure/adapters/out/database/drizzle-entrega.repository.ts` (`ENTREGA_REPOSITORY_PORT`) |
| Evidencia | `STORAGE_PORT` de Pagos (Cloudinary) |
| Eventos | `infrastructure/adapters/out/events/event-emitter-entrega-events.adapter.ts` (`ENTREGA_EVENTS_PORT`) |

## 🌐 Endpoints (todos con JWT)

| Método | Ruta | Quién | Qué hace |
| :--- | :--- | :--- | :--- |
| `POST` | `/entregas` (multipart) | Organizador | Registra la entrega del turno vigente: `idNumber`, `transferAmount`, `cashAmount` y `file` (foto). |
| `GET` | `/entregas/:id` | Organizador o receptor | Consulta la entrega con su evidencia. |
| `PATCH` | `/entregas/:id/confirmar` | Receptor | Confirma que recibió el dinero y cierra el turno. |
| `POST` | `/entregas/:id/problema` | Receptor | Reporta un problema (`motivo`); abre una disputa y el turno sigue abierto. |

## 📏 Reglas de negocio

- Solo el organizador (o `admin_global`) registra, y solo en una tanda `ACTIVA`.
- El número debe ser el **turno vigente** y no tener entrega previa; el número muerto no recibe entregas.
- `transferAmount + cashAmount` debe sumar exactamente `cuota × participantes` (comparado en centavos).
- Registrar crea `payout` con `confirmed_by_admin = true` y su `evidence` en una sola transacción; el número pasa a `ENTREGA_PENDIENTE_CONFIRMACION`.
- Confirmar (solo el dueño del número) pone `payout.status = CONFIRMADO` y `number.status = ENTREGADO` dentro de una transacción.

## 📣 Eventos

| Evento | Cuándo | Quién escucha |
| :--- | :--- | :--- |
| `entrega.registrada` | Al registrar la entrega | `NotificacionModule`: avisa al receptor con la ruta `/entregas/:id` para que confirme. |

Si el bus falla, la entrega igual queda registrada (solo se escribe el error en el log).

## 🗄️ Índices

- `payout_id_number_status_idx` en `payout (id_number, status)` — migración `0002`.
- `evidence_id_payout_idx` en `evidence (id_payout)`.

## 🧪 Pruebas

```bash
# Unitarias
npx vitest run src/entregas

# Integración crear → pagar → confirmar → entregar → cerrar turno (PostgreSQL local)
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/tandea_dev" npm run test:e2e -- test/entrega-flujo.e2e-spec.ts
```
