# Módulo de Tandas — Tandea (Documentación Técnica)

El módulo de Tandas orquesta la creación, configuración financiera, invitación de miembros, selección y reserva de turnos de cobro, así como el seguimiento de tandas organizadas y participadas.

---

## 📱 Pantallas Existentes (`lib/features/tandas/presentation/screens/`)

### 1. `TandasNavigationScreen` (`tandas_navigation_screen.dart`)
* **Ruta en GoRouter**: `/tandas`
* **Propósito**: Pantalla contenedora principal con barra de navegación inferior (`BottomNavigationBar`) o pestañas superiores para alternar entre:
  * Pestaña 1: **"Como participante"** (`MisTandasParticipanteScreen`).
  * Pestaña 2: **"Como organizador"** (`MisTandasOrganizadorScreen`).
* **Acciones flotantes**:
  * Botón Flotante (FAB) o acción en AppBar para "Crear tanda" o "Unirme a una tanda".

### 2. `MisTandasParticipanteScreen` (`mis_tandas_participante_screen.dart`)
* **Propósito**: Muestra las tandas en las que el usuario actual está inscrito como participante cobrador/aportador.
* **Componentes**:
  * Usa `MisTandasListView` alimentado por `TandasProvider.tandasParticipante`.
  * Cada fila usa `TandaCardItem` mostrando: número de turno asignado, estado de pago actual (al corriente / pendiente) y monto de la cuota periódica.

### 3. `MisTandasOrganizadorScreen` (`mis_tandas_organizador_screen.dart`)
* **Propósito**: Muestra las tandas administradas por el usuario actual como organizador (`idAdmin`).
* **Funcionalidades**:
  * Visualización del avance de inscripciones (`numParticipants` registrados vs cupo total).
  * Código de invitación de acceso rápido.
  * Botón de administración rápida para compartir código o revisar pagos pendientes.

### 4. `CrearTandaScreen` (`crear_tanda_screen.dart`)
* **Ruta en GoRouter**: `/tandas/crear`
* **Propósito**: Formulario para dar de alta una nueva tanda (Historia de usuario **AP-01**).
* **Entradas interactivas**:
  * Nombre de la tanda y descripción opcional.
  * Tipo de tanda (catálogo `tanda_type`: familiar, amigos, laboral).
  * Periodicidad (`Semanal`, `Quincenal`, `Mensual`).
  * Monto de aportación por participante (`contributionAmount`).
  * Número de participantes (`numParticipants`, mínimo 2).
  * Número de vueltas (`numRounds`, por defecto 1).
  * Días de gracia antes de declarar mora (`DiasGraciaStepper`).
  * Switch de activación de **Número Muerto** (`hasDeadNumber`).
* **Cálculo Reactivo en Vivo (`ResumenEstimadoCard`)**:
  * A medida que el usuario modifica los campos, se ejecuta la función de cálculo financiero proyectando el total acumulado por turno, fecha estimada de inicio y término.

### 5. `CompartirCodigoTandaScreen` (`compartir_codigo_tanda_screen.dart`)
* **Ruta en GoRouter**: `/tandas/compartir`
* **Propósito**: Presenta el código único alfanumérico generado (`inviteCode`) tras la creación exitosa de una tanda.
* **Componentes**:
  * Tarjeta central con el código en tipografía destacada.
  * Botón de copiado directo al portapapeles (`Clipboard`).
  * Botón de integración con `share_plus` para compartir directamente en WhatsApp u otras aplicaciones de mensajería con texto formateado.

### 6. `UnirseTandaScreen` (`unirse_tanda_screen.dart`)
* **Ruta en GoRouter**: `/tandas/unirse`
* **Propósito**: Permite a un participante inscribirse en una tanda existente mediante el código de invitación (**AP-02**).
* **Flujo**:
  1. Campo de texto con auto-formateo en mayúsculas de 8 caracteres.
  2. Valida contra el backend que la tanda exista, esté en estado `PENDIENTE` y tenga cupo libre.
  3. Si la asignación es manual, transiciona a `SeleccionarNumeroScreen`. Si es aleatoria/sorteo, confirma la asignación y redirige a "Mis tandas".

### 7. `SeleccionarNumeroScreen` (`seleccionar_numero_screen.dart`)
* **Ruta en GoRouter**: `/tandas/seleccionar-numero`
* **Propósito**: Cuícula interactiva (*Grid*) con los turnos de cobro disponibles (`1..numParticipants`).
* **Estados visuales del turno**:
  * **Libre**: Seleccionable por el usuario.
  * **Ocupado**: Bloqueado con avatar o indicador de tomado.
  * **Número Muerto**: Reservado para fondo de garantía (inhabilitado).
* **Protección de concurrencia**: Si otro participante toma el número milisegundos antes, el backend responde HTTP 409 Conflict y la pantalla refresca la cuadrícula solicitando una nueva selección.

---

## 🔗 Endpoints del Backend Vinculados (`Tandea-Back-End`)

* **`POST /api/v1/tandas`**: Crea tanda, calcula el plan financiero y genera el `inviteCode` criptográfico único.
* **`POST /api/v1/tandas/unirse`**: Valida código de invitación, cupos y añade al participante.
* **`PATCH /api/v1/tandas/:id/numero`**: Reserva y asigna un número específico de cobro para el participante.
* **`GET /api/v1/tandas`**: Consulta listados con filtros por rol (`participante` u `organizador`).
