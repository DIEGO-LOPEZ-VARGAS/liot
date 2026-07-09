# Sistema Web de Registro para Laboratorio IIoT

## Requisitos
- Node.js (v18 o superior)
- Opcional: PostgreSQL o cuenta en Railway

## Uso local

### Instalación rápida
```bash
cd backend
npm install
npm start
```

Acceso en `http://localhost:3000`

### Alternativas para correr desde raíz:
- Linux/macOS: `./scripts/run.sh`
- Windows PowerShell: `.\scripts\run.ps1`

## Deploy en Railway (recomendado)

### 1. Preparar repositorio GitHub
```bash
# Clonar o iniciar git en tu carpeta
git init
git add .
git commit -m "Inicial: Sistema IIoT"

# Crear repo en GitHub y hacer push
git remote add origin https://github.com/tu_usuario/lab-iiot.git
git branch -M main
git push -u origin main
```

### 2. Conectar a Railway
1. Accede a https://railway.app/
2. Log in con GitHub
3. New Project → Import from GitHub Repository → selecciona tu repo
4. Railway detectará automáticamente que es Node.js
5. Click en "PostgreSQL" en Services para agregar BD
6. Esperaremos a que Railway cree la BD automáticamente
7. Deploy estará listo en 2-5 minutos

### 3. Variables de entorno en Railway
- Railway agregará `DATABASE_URL` automáticamente si añadiste PostgreSQL
- No necesitas más configuración — el código se adapta automáticamente

### 4. Acceder a tu app
Una vez deployado, verás la URL pública. Ejemplo: `https://lab-iiot-prod.up.railway.app`

## Funcionamiento

### URLs principales
- Formulario de registro: `/registro`
- Panel de administración: `/admin`
- Login: `/login`

### Credenciales por defecto
- Usuario: `admin`
- Contraseña: `admin123`

### Características
- El formulario de registro captura laboratorio, integrantes y materiales
- Panel administrativo permite filtrar por fecha, laboratorio o texto de búsqueda
- Los datos se guardan automáticamente en PostgreSQL (o JSON localmente)
- Estadísticas en tiempo real del panel admin

## Estructura
```
lab-iiot/
├── backend/
│   ├── controllers/
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   ├── data/
│   ├── package.json
│   └── server.js
└── frontend/
    ├── css/
    ├── js/
    └── pages/
```

## Notas
- El código automáticamente detecta y usa PostgreSQL si está disponible (`DATABASE_URL`)
- Si no hay BD, usa almacenamiento JSON local (`backend/data/storage.json`) para desarrollo
- Railway proporciona PostgreSQL managed incluido — no necesitas configurar nada extra
- Todos los archivos están listos para git — `.gitignore` excluye dependencies y datos sensibles

