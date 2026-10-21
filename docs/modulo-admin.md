# Módulo de Administración Global — Tandea (Documentación Técnica)

El módulo de Administración Global provee visibilidad analítica y herramientas de supervisión para el usuario con rol `admin_global`, garantizando la transparencia, cumplimiento y resolución de incidentes en la plataforma.

---

## 📱 Pantallas Existentes (`lib/features/admin/presentation/screens/`)

### 1. `AdminDashboardScreen` (`admin_dashboard_screen.dart`)
* **Ruta en GoRouter**: `/admin`
* **Acceso**: Restringido mediante Guard en `AppRouter` validando que el JWT contenga `role == 'admin_global'`.
* **Componentes y Métricas Globales**:
  * **Tarjetas de Estadísticas (KPIs)**:
    * Total de usuarios activos vs suspendidos.
    * Tandas en curso (`ACTIVA`) vs finalizadas o canceladas.
    * Volumen total de capital gestionado a través de la plataforma ($ MXN).
    * Casos y disputas abiertas pendientes de resolución.
  * **Panel de Acciones Rápidas**:
    * Búsqueda y suspensión temporal de usuarios por mala conducta o impago reiterado.
    * Configuración de parámetros globales de plataforma (`platform_config`): número máximo de tandas activas por usuario, cupo máximo de participantes y días de gracia permitidos.
    * Bitácora inmutable de auditoría (`audit_log`).

---

## 🔗 Endpoints del Backend Vinculados (`Tandea-Back-End`)

* **`GET /api/v1/admin/metricas`**: Calcula y consolida las estadísticas analíticas globales de la plataforma.
* **`PATCH /api/v1/admin/usuarios/:id/suspender`**: Desactiva el acceso de un usuario (`user.active = false`).
* **`GET /api/v1/admin/disputas`**: Lista las quejas o discrepancias entre participantes y organizadores con notas de resolución.
* **`PUT /api/v1/admin/configuracion`**: Actualiza los límites generales del sistema en `platformConfigTable`.
