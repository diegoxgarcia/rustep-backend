# LEEME PRIMERO - Rustep Backend

¡Bienvenido al backend de Rustep! Este archivo te ayudará a empezar rápidamente.

---

## ¿Por dónde empiezo?

Dependiendo de tu objetivo, empieza por aquí:

### 🚀 Quiero empezar YA
**Lee:** [QUICK_START.md](QUICK_START.md)

Tendrás el servidor funcionando en 5 minutos.

### 📚 Quiero entender el proyecto
**Lee:** [INDEX.md](INDEX.md) → [README.md](README.md)

El INDEX.md te guiará por toda la documentación.

### 💻 Soy desarrollador y quiero integrarme
**Lee:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

Toda la referencia de endpoints con ejemplos.

### 🏗️ Quiero entender la arquitectura
**Lee:** [ARCHITECTURE.md](ARCHITECTURE.md)

Diagramas, flujos de datos, y diseño del sistema.

### 🚢 Quiero deployar a producción
**Lee:** [DEPLOYMENT.md](DEPLOYMENT.md)

Guía completa para despliegue en diferentes plataformas.

---

## Lo que NECESITAS saber

### Requisitos previos
- Node.js v18 o superior
- MongoDB v6 o superior
- PostgreSQL v14 o superior
- npm v9 o superior

### Instalación rápida con Docker

```bash
# 1. Clonar/ubicar el proyecto
cd rustep-backend

# 2. Iniciar todos los servicios
docker-compose up -d

# 3. Ejecutar migraciones
docker-compose exec api npm run prisma:migrate

# 4. Listo! API corriendo en http://localhost:3000
```

### Instalación manual

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Generar cliente de Prisma
npm run prisma:generate

# 4. Ejecutar migraciones
npm run prisma:migrate

# 5. Iniciar servidor
npm run dev
```

---

## Estructura del proyecto

```
rustep-backend/
├── 📄 Documentación (8 archivos .md)
├── ⚙️ Configuración (package.json, .env, Docker, etc)
├── 🔧 src/ - Código fuente
│   ├── config/     - Configuraciones
│   ├── middleware/ - Middlewares
│   ├── modules/    - 6 módulos (auth, users, steps, stamina, friends, rankings)
│   └── utils/      - Utilidades
├── 🗄️ models/      - Schemas MongoDB (3 modelos)
├── 🗄️ prisma/      - Schema PostgreSQL
└── 🧪 tests/       - Tests
```

**Total:** 51 archivos creados, listos para usar.

---

## Características principales

### ✅ Lo que YA está implementado

1. **Autenticación completa**
   - Google OAuth 2.0
   - JWT + Refresh tokens
   - Protección de rutas

2. **Sistema de pasos**
   - Registro de sesiones
   - Detección de fraude en tiempo real
   - Puntuación de confianza (0-1)

3. **Economía de stamina**
   - 10 stamina por 1,000 pasos
   - Límite diario de 100 stamina
   - Sistema de transacciones completo

4. **Funciones sociales**
   - Solicitudes de amistad
   - Gestión de amigos
   - Rankings entre amigos

5. **Rankings semanales**
   - 4 categorías de rankings
   - Actualización automática semanal (cron)
   - Posiciones personalizadas

6. **Seguridad**
   - Rate limiting
   - Validación de inputs
   - Manejo de errores
   - Logging completo

---

## Bases de datos

### MongoDB (Mongoose)
- `users` - Perfiles de usuario
- `steps_logs` - Sesiones de pasos
- `fraud_flags` - Detección de fraude

### PostgreSQL (Prisma)
- `stamina_ledger` - Transacciones
- `friendships` - Amistades
- `rankings` - Clasificaciones
- `rewards` - Recompensas
- Y más...

---

## API Endpoints

**27 endpoints REST** organizados en 6 módulos:

- **Auth** (4) - Autenticación
- **Users** (5) - Usuarios
- **Steps** (4) - Pasos
- **Stamina** (5) - Energía
- **Friends** (6) - Amigos
- **Rankings** (3) - Clasificaciones

Ver detalles completos en [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

---

## Testing rápido

Una vez que el servidor esté corriendo:

### Health Check
```bash
curl http://localhost:3000/health
```

### Listar endpoints
```bash
curl http://localhost:3000/
```

---

## Comandos útiles

```bash
# Desarrollo
npm run dev              # Servidor con auto-reload

# Base de datos
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Ejecutar migraciones
npm run prisma:studio    # Abrir GUI de base de datos
npm run seed             # Cargar datos de ejemplo

# Calidad de código
npm run lint             # Ejecutar linter
npm run format           # Formatear código
npm test                 # Ejecutar tests

# Producción
npm start                # Servidor de producción
```

---

## Variables de entorno importantes

Mínimas necesarias en `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rustep

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/rustep_postgres

# JWT
JWT_SECRET=tu-secreto-super-seguro-aqui

# Google OAuth
GOOGLE_CLIENT_ID=tu-client-id-de-google
GOOGLE_CLIENT_SECRET=tu-client-secret-de-google
```

Ver todas las variables en [.env.example](.env.example)

---

## Documentación disponible

1. **INDEX.md** - Índice de navegación
2. **README.md** - Documentación principal
3. **QUICK_START.md** - Inicio rápido
4. **API_DOCUMENTATION.md** - Referencia de API
5. **ARCHITECTURE.md** - Arquitectura del sistema
6. **DEPLOYMENT.md** - Guía de despliegue
7. **PROJECT_SUMMARY.md** - Resumen del proyecto
8. **CHANGELOG.md** - Historial de cambios

---

## Siguientes pasos

1. ✅ Leer este archivo (¡ya lo hiciste!)
2. ⏭️ Ir a [QUICK_START.md](QUICK_START.md) para configurar
3. ⏭️ Revisar [API_DOCUMENTATION.md](API_DOCUMENTATION.md) para endpoints
4. ⏭️ Explorar el código en `src/modules/`
5. ⏭️ Ejecutar `npm run dev` y empezar a desarrollar

---

## ¿Problemas?

### MongoDB no conecta
- Verificar que MongoDB esté corriendo: `mongosh`
- Revisar `MONGODB_URI` en `.env`

### PostgreSQL no conecta
- Verificar que PostgreSQL esté corriendo: `psql --version`
- Revisar `DATABASE_URL` en `.env`
- Ejecutar migraciones: `npm run prisma:migrate`

### Prisma Client no encontrado
- Ejecutar: `npm run prisma:generate`

### Puerto 3000 ocupado
- Cambiar `PORT` en `.env`
- O detener el proceso que usa el puerto

Ver más en la sección de Troubleshooting de [QUICK_START.md](QUICK_START.md)

---

## Soporte

- **Documentación:** Todos los archivos .md en este directorio
- **Issues:** GitHub Issues
- **Email:** support@rustep.com

---

## Licencia

MIT License

---

**¡Listo para empezar!**

El backend está completamente construido y documentado.
Solo necesitas configurar las variables de entorno y ejecutar.

**Siguiente paso:** [QUICK_START.md](QUICK_START.md)

---

Construido con Node.js, Express, MongoDB, PostgreSQL y Prisma
Desarrollado para Rustep - The Fitness Casual Game
