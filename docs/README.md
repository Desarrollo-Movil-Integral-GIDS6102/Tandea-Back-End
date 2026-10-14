# 📚 Documentación Técnica de Tandea Back-End

Bienvenido al directorio de documentación técnica y de API de **Tandea Back-End**.

Aquí encontrarás las guías de referencia de cada módulo implementado en la arquitectura hexagonal del sistema.

---

## 📂 Módulos Documentados

| Módulo | Documento | Descripción | Estado |
| :--- | :--- | :--- | :---: |
| **Tandas** | [docs/tandas.md](./tandas.md) | CRUD completo de tandas, filtros, ordenamiento, paginación, unión mediante código único, asignación de turnos y control de acceso con JWT. | ✅ Implementado |
| **Autenticación** | `src/auth/` | Registro de usuarios, login con JWT, roles (`usuario`, `admin_global`) y notificaciones con Brevo. | ✅ Implementado |
| **Pagos** | `src/pagos/` | Registro de pagos híbridos (efectivo/transferencia), validación OCR y doble confirmación. | ✅ Implementado |
| **Postman** | [postman/tandea-api.postman_collection.json](./postman/tandea-api.postman_collection.json) | Colección Postman v2.1.0 lista para importar con variables dinámicas y auto-guardado de JWT. | ✅ Disponible |

---

## 🚀 Guía Rápida de Ejecución

### 1. Variables de Entorno (`.env`)
Asegúrate de contar con las variables de base de datos y JWT configuradas:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/tandea
JWT_SECRET=tu_clave_secreta_jwt
DATABASE_SSL=false
```

### 2. Compilar el Proyecto
```bash
npm run build
```

### 3. Ejecutar Pruebas Unitarias
```bash
npm test
```

### 4. Ejecutar el Linter
```bash
npm run lint
```
