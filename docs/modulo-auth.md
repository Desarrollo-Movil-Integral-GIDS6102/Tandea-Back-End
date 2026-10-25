# Módulo de Autenticación — Tandea (Documentación Técnica)

El módulo de Autenticación gestiona el ciclo de vida del usuario, registro seguro con validaciones estrictas de contraseñas, inicio de sesión mediante JWT, persistencia de credenciales seguras y redirección según el rol de la cuenta.

---

## 📱 Pantallas Existentes (`lib/features/auth/presentation/screens/`)

### 1. `WelcomeScreen` (`welcome_screen.dart`)
* **Ruta en GoRouter**: `/welcome` (o raíz `/` para usuarios no autenticados).
* **Propósito**: Pantalla inicial de bienvenida que presenta la propuesta de valor de Tandea.
* **Componentes**:
  * `WelcomeHeader`: Logo de Tandea, título y subtítulo.
  * Píldoras de beneficios (`WelcomeFeatureChip`).
  * `WelcomeBottomPanel`: Botón principal "Iniciar sesión" y botón secundario "Crear cuenta".

### 2. `LoginScreen` (`login_screen.dart`)
* **Ruta en GoRouter**: `/login`
* **Propósito**: Entrada al sistema con correo electrónico y contraseña.
* **Flujo**:
  1. El usuario ingresa `email` y `password`.
  2. Valida formato de correo y longitud mínima antes de despachar la petición.
  3. `AuthProvider.login()` envía la solicitud a `POST /api/v1/auth/login`.
  4. Si las credenciales son válidas, almacena el `access_token` en `flutter_secure_storage`.
  5. Redirige a `/tandas` (o `/admin` si el rol devuelto en el JWT es `admin_global`).

### 3. `RegisterScreen` (`register_screen.dart`)
* **Ruta en GoRouter**: `/register`
* **Propósito**: Registro de nuevos participantes en la plataforma.
* **Campos del formulario**:
  * `name` (Nombre, obligatorio).
  * `lastName` (Apellido, obligatorio).
  * `email` (Correo electrónico, obligatorio y con formato RFC válido).
  * `password` (Contraseña, con validación en tiempo real).
  * `confirmPassword` (Confirmación idéntica de contraseña).
  * `age` (Edad opcional, mínimo 18 años).
  * `gender` (Género opcional).
* **Validación de Contraseñas Robustas (`register_validators.dart`)**:
  * Longitud mínima de 8 caracteres (alineado a `PASSWORD_MIN_LENGTH` del backend).
  * Prohibición de secuencias numéricas/alfabéticas triviales (`123456`, `abcdef`).
  * Prohibición de palabras comunes del diccionario de claves débiles.
  * Prohibición de incluir el correo o nombre del usuario dentro de la clave.

---

## ⚙️ Gestores de Estado (`lib/features/auth/presentation/providers/`)

### `AuthProvider` (`auth_provider.dart`)
* **Responsabilidad**:
  * Administra los estados: `isInitial`, `isLoading`, `isAuthenticated`, `isError`.
  * Expone métodos asíncronos:
    * `login(String email, String password)`
    * `register(RegisterParams params)`
    * `logout()`
  * Guarda y limpia el token de sesión en coordinación con `AuthSessionProvider`.

---

## 🔗 Endpoints del Backend Vinculados (`Tandea-Back-End`)

* **`POST /api/v1/auth/login`**:
  * Valida hash con `bcrypt.compare`.
  * Genera JWT firmado con `sub` (idUser) y `role`.
  * Retorna HTTP 401 si las credenciales son inválidas o 403 si `active = false`.
* **`POST /api/v1/auth/register`**:
  * Valida payload con `zRegisterDto` en Zod.
  * Comprueba que el correo no esté duplicado (409 Conflict).
  * Inserta usuario en `userTable` con `id_role` asignado al rol `usuario`.
  * Dispara envío de correo de bienvenida mediante `BrevoMailAdapter`.
