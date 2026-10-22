# Catálogo de Componentes y Widgets Reutilizables — Tandea

Este documento compila todos los componentes, botones y widgets compartidos en la capa de presentación de Flutter (`Tandea-Front-End`), diseñados para mantener consistencia visual, accesibilidad y reutilización en toda la aplicación.

---

## 1. Botones Principales Compartidos (`lib/core/widgets/`)

### 1.1 `PrimaryButton`
* **Ubicación**: `lib/core/widgets/primary_button.dart`
* **Propósito**: Botón de acción principal (CTA) con elevación, bordes redondeados y soporte integrado para estado de carga (`isLoading`).
* **Propiedades**:
  * `text` (`String`): Texto mostrado en el botón.
  * `onPressed` (`VoidCallback?`): Acción ejecutada al presionar (si es `null` o `isLoading` es `true`, el botón se desactiva visual y funcionalmente).
  * `isLoading` (`bool`, por defecto `false`): Muestra un `CircularProgressIndicator` centrado en lugar del texto.
  * `icon` (`IconData?`): Ícono opcional a la izquierda del texto.
  * `backgroundColor` (`Color?`): Color de fondo personalizado (por defecto usa `AppColors.primary`).
  * `textColor` (`Color?`): Color del texto e ícono (por defecto `Colors.white`).
  * `height` (`double`, por defecto `50.0`): Altura estándar accesible.
  * `isFullWidth` (`bool`, por defecto `true`): Expande el botón al ancho disponible.

```dart
// Ejemplo de uso:
PrimaryButton(
  text: 'Iniciar Sesión',
  isLoading: authProvider.isLoading,
  onPressed: () => _submitForm(),
)
```

---

### 1.2 `SecondaryButton`
* **Ubicación**: `lib/core/widgets/secondary_button.dart`
* **Propósito**: Botón de acción secundaria con estilo delineado (*outlined*) o tonal suave, utilizado para acciones alternativas como "Cancelar", "Registrarse" o "Volver".
* **Propiedades**:
  * `text` (`String`): Etiqueta textual.
  * `onPressed` (`VoidCallback?`): Callback de ejecución.
  * `isLoading` (`bool`, por defecto `false`): Indicador de progreso integrado.
  * `icon` (`IconData?`): Ícono opcional.
  * `borderColor` (`Color?`): Color del contorno (por defecto `AppColors.primary`).
  * `textColor` (`Color?`): Color del texto (por defecto `AppColors.primary`).
  * `height` (`double`, por defecto `50.0`).

```dart
// Ejemplo de uso:
SecondaryButton(
  text: 'Crear una cuenta',
  onPressed: () => context.push('/register'),
)
```

---

## 2. Widgets Reutilizables de Autenticación (`lib/features/auth/presentation/widgets/`)

### 2.1 `WelcomeHeader`
* **Ubicación**: `lib/features/auth/presentation/widgets/welcome_header.dart`
* **Propósito**: Encabezado visual de la pantalla de bienvenida con isotipo/logotipo de Tandea, eslogan y gradiente de marca (`AppColors.primaryNavy` a `AppColors.primary`).

### 2.2 `WelcomeFeatureChip`
* **Ubicación**: `lib/features/auth/presentation/widgets/welcome_feature_chip.dart`
* **Propósito**: Píldora informativa con ícono y texto que destaca ventajas del sistema (ej. "Ahorro seguro", "Comprobantes OCR", "Sin comisiones ocultas").

### 2.3 `WelcomeBottomPanel`
* **Ubicación**: `lib/features/auth/presentation/widgets/welcome_bottom_panel.dart`
* **Propósito**: Tarjeta inferior flotante (*bottom panel*) que agrupa los botones principales de inicio de sesión y registro rápido con redirección mediante `go_router`.

---

## 3. Widgets Reutilizables de Tandas (`lib/features/tandas/presentation/widgets/`)

### 3.1 `TandaCardItem`
* **Ubicación**: `lib/features/tandas/presentation/widgets/tanda_card_item.dart`
* **Propósito**: Tarjeta de resumen de una tanda dentro del listado "Mis tandas". Muestra:
  * Nombre de la tanda y tipo (Familiar, Amigos, Laboral).
  * Monto de la cuota y periodicidad (semanal, quincenal, mensual).
  * Píldora de estado (`PENDIENTE`, `ACTIVA`, `FINALIZADA`).
  * Rol del usuario actual (Organizador vs Participante) y turno asignado.
  * Indicador de pago pendiente o al corriente.

### 3.2 `MisTandasListView`
* **Ubicación**: `lib/features/tandas/presentation/widgets/mis_tandas_list_view.dart`
* **Propósito**: Contenedor con `RefreshIndicator`, `ListView.separated` y manejo de estados vacíos (*Empty State* ilustrado) y errores para el panel de tandas.

### 3.3 `ResumenEstimadoCard`
* **Ubicación**: `lib/features/tandas/presentation/widgets/resumen_estimado_card.dart`
* **Propósito**: Tarjeta reactiva para el formulario de creación de tandas. Recalcula y renderiza en tiempo real:
  * Total a reunir por ronda (`monto * participantes`).
  * Duración estimada y fecha proyectada de término.
  * Estado y turno del número muerto (si está activado).

### 3.4 `DiasGraciaStepper`
* **Ubicación**: `lib/features/tandas/presentation/widgets/dias_gracia_stepper.dart`
* **Propósito**: Selector numérico incremental (+/-) con validación de límites de plataforma para configurar los días de gracia permitidos antes de penalizar impagos.

---

## 4. Paleta de Colores y Estilos Compartidos (`lib/core/constants/app_colors.dart`)

| Constante | Código Hexadecimal | Propósito |
| :--- | :---: | :--- |
| `AppColors.primaryNavy` | `#0D2B3E` | Azul marino institucional para barras superiores y headers |
| `AppColors.primary` | `#1B4F72` | Azul acento principal para botones y llamados a la acción |
| `AppColors.successGreen` | `#1F8A4C` | Verde para pagos confirmados, turnos al corriente y comprobantes válidos |
| `AppColors.warningGold` | `#C99700` | Amarillo/dorado para pagos pendientes de revisión u OCR dudoso |
| `AppColors.errorRed` | `#C0392B` | Rojo para pagos rechazados, turnos en riesgo y validaciones fallidas |
| `AppColors.surfaceBackground` | `#F3F7F9` | Fondo claro estándar para pantallas |
| `AppColors.cardBackground` | `#FFFFFF` | Fondo de tarjetas y paneles elevados |
| `AppColors.textInk` | `#12303F` | Color de texto con alto contraste |
| `AppColors.textMute` | `#5A7280` | Texto secundario y subtítulos |
