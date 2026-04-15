# StudyCore AI — Product Requirements Document (PRD)

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Estado:** En desarrollo activo

---

## 1. Visión del Producto

StudyCore AI es una aplicación de escritorio educativa para estudiantes de bachillerato venezolano (y latinoamericano en general). Su premisa central es simple: **el colegio no debe lograr que todos piensen igual, sino que cada quien desarrolle su propio pensamiento**.

La app reemplaza el cuaderno físico, la agenda de papel y el profesor particular — todo en un solo lugar, gratuito y offline-capable — usando IA para adaptar las explicaciones a cómo aprende cada estudiante específicamente.

---

## 2. Problema que Resuelve

| Problema real | Cómo lo resuelve StudyCore AI |
|---|---|
| Apuntes en cuadernos físicos se pierden, deterioran o no se pueden buscar | Cuaderno digital con jerarquía organizada y búsqueda |
| El estudiante no puede repasar si no entiende la letra o el orden de sus notas | OCR con Gemini Vision lee hasta texto manuscrito y diagramas |
| Profesores particulares son caros y no están disponibles a cualquier hora | Profesor IA disponible 24/7, gratuito, especializado por materia |
| Las explicaciones de los profesores son iguales para todos | IA que adapta explicaciones a los intereses y estilo de cada estudiante |
| No existe un solo lugar donde el estudiante gestione materias, notas, fechas y calificaciones | Dashboard unificado con todas las funciones integradas |

---

## 3. Usuarios Objetivo

**Usuario primario:** Estudiante de bachillerato (14–18 años), Venezuela / Latinoamérica.

**Perfil:**
- Acceso a computadora (Windows principalmente)
- Conexión a internet intermitente
- Escribe apuntes a mano en cuadernos físicos
- Estudia materias del currículo venezolano: Matemáticas, Física, Química, Biología, Historia, Literatura, Inglés
- Trabaja por lapsos (3 lapsos anuales) o semestres
- Sistema de calificación de 0–20 puntos

**Usuarios secundarios (futuro):** Padres que quieren seguimiento, estudiantes universitarios.

---

## 4. Principios de Diseño

1. **Gratuito primero** — toda la IA central usa el tier gratuito de Google Gemini (1500 req/día). No se pide tarjeta de crédito.
2. **Pensamiento propio** — la IA nunca resuelve tareas por el estudiante; explica, orienta y corrige.
3. **Adaptativo** — el profesor IA ajusta analogías y ejemplos a los intereses del estudiante.
4. **Sin fricción** — una foto del cuaderno es suficiente para digitalizar una clase completa.
5. **Offline-friendly** — la app funciona en Electron sin browser abierto; el backend es local.

---

## 5. Arquitectura Técnica

```
┌─────────────────────────────────────────────┐
│              Electron 33 (shell)             │
│  ┌────────────────┐   ┌────────────────────┐ │
│  │  React 18+Vite │   │  Flask 3 + SQLite  │ │
│  │  TailwindCSS 3 │◄──│  (127.0.0.1:5000)  │ │
│  │  (localhost:   │   │                    │ │
│  │   5173 / dist) │   │  Gemini Flash API  │ │
│  └────────────────┘   │  EasyOCR (local)   │ │
│                       │  Tesseract (local) │ │
│                       └────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Stack:**
- **Frontend:** React 18, Vite 5, TailwindCSS 3, Axios, Lucide Icons, React Hot Toast
- **Backend:** Python 3.12+, Flask 3, SQLite (WAL), python-dotenv
- **IA principal:** Google Gemini Flash (google-genai SDK) — gratis
- **OCR:** Gemini Vision (primario) → EasyOCR (fallback local) → Tesseract (último recurso)
- **Desktop:** Electron 33 (frameless, custom TitleBar)

**Base de datos: SQLite local**

```
users
subjects (materia con icono y color)
  └─ periods (lapso / semestre)
       └─ topics (tema del lapso)
            └─ entries (clase con fecha + contenido)
events (calendario)
evaluations (notas y calificaciones)
notes (apuntes legacy / compatibilidad)
groups / group_members / group_content
ai_conversations
  └─ ai_sources (temas del cuaderno + URLs + videos)
```

---

## 6. Stack Tecnológico — Detalle Completo

### 6.1 Frontend

#### React 18
El núcleo de la interfaz. Se usa la arquitectura de componentes funcionales con hooks (`useState`, `useEffect`, `useCallback`, `useRef`). Cada página es un componente independiente y la navegación entre secciones se maneja con React Router.

**Por qué React:** ecosistema maduro, compatible con Electron, excelente soporte de hot reload en desarrollo, y permite construir interfaces complejas (como el cuaderno con navegación de 4 niveles) de forma mantenible.

#### Vite 5
Herramienta de build y servidor de desarrollo. Reemplaza a Webpack. Compila el proyecto en milisegundos gracias a su uso de ESModules nativos del navegador en desarrollo.

**Proxy configurado:** todas las peticiones a `/api/*` se redirigen automáticamente a `http://127.0.0.1:5000` durante desarrollo, por lo que el frontend no necesita saber la dirección del backend.

```js
// vite.config.js
server: {
  proxy: {
    '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true }
  }
}
```

#### TailwindCSS 3
Framework de estilos utility-first. Toda la UI se construye con clases directamente en JSX, sin archivos CSS separados. Configurado con un tema oscuro personalizado (`dark mode: class`), colores de marca propios (`brand`, `surface-50`) y animaciones personalizadas (`animate-fade-in`).

**Por qué Tailwind:** velocidad de desarrollo muy alta para UI dark mode, consistencia visual, y el output final es muy pequeño porque purga las clases no usadas.

#### Axios
Cliente HTTP para comunicarse con el backend Flask. Configurado con:
- `baseURL: '/api'` — rutas relativas que el proxy de Vite traduce
- `timeout: 30000` — 30 segundos para peticiones normales, 60 para OCR
- Interceptor global de errores — extrae el mensaje de error del servidor y lo convierte en un `Error` de JavaScript uniforme

#### Lucide React
Biblioteca de iconos SVG. Ofrece más de 1000 iconos consistentes en estilo, todos como componentes React con props de tamaño y color.

#### React Hot Toast
Sistema de notificaciones (toasts) no intrusivas. Aparecen en la esquina de la pantalla para confirmar acciones, advertir errores o mostrar el motor OCR que procesó la imagen.

---

### 6.2 Backend

#### Python 3.12+
Lenguaje principal del backend. Se usa tipado de hints (`str`, `dict`, `list | None`) y f-strings para toda la lógica del servidor.

#### Flask 3
Microframework web. Toda la API REST está construida con Flask usando **Blueprints** para organizar las rutas por módulo:

```
/api/subjects/     → subjects.py
/api/events/       → events.py
/api/evaluations/  → evaluations.py
/api/notes/        → notes.py
/api/notebook/     → notebook.py   ← cuaderno digital completo
/api/ocr/          → ocr.py
/api/ai/           → ai.py
/api/groups/       → groups.py
```

Cada Blueprint vive en su propio archivo, maneja sus propias rutas, y se registra en el factory `create_app()` de `backend/app.py`.

**Flask-CORS:** permite peticiones cross-origin desde el frontend de Vite (puerto 5173) y desde Electron (`file://`, `app://.`).

**Por qué Flask y no FastAPI:** menor overhead, más simple para un proyecto de un solo usuario, compatible con Python 3.12+ sin configuración adicional, y el rendimiento de FastAPI no es necesario en una app local de escritorio.

#### SQLite + sqlite3 (stdlib)
Base de datos local. No requiere servidor de base de datos separado — el archivo `.db` vive en `database/studycore.db`. Se usa el módulo `sqlite3` de la biblioteca estándar de Python, sin ORM.

**Decisiones de implementación:**
- `conn.row_factory = sqlite3.Row` — las filas devuelven datos accesibles por nombre de columna además de índice
- `PRAGMA foreign_keys = ON` — integridad referencial activa en cada conexión
- `PRAGMA journal_mode = WAL` — Write-Ahead Logging para mejor rendimiento en lecturas concurrentes
- **Una conexión por request** — cada endpoint abre y cierra su propia conexión; evita problemas de threading
- **Sin WAL en `init_db()`** — `executescript()` hace commit implícito; combinar WAL con executescript en Python 3.12+ generaba conflictos silenciosos

**Esquema de migraciones:** en lugar de herramientas como Alembic, se usa una función `_run_migration()` en `database.py` que ejecuta `CREATE TABLE IF NOT EXISTS` al arrancar. Así las tablas nuevas se crean en bases de datos existentes sin romper los datos.

#### python-dotenv
Carga las variables de entorno desde el archivo `.env` al iniciar el backend. Las variables se leen en `backend/config/settings.py` usando el patrón:

```python
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or ""
DATABASE_PATH  = os.getenv("DATABASE_PATH") or str(BASE_DIR / "database" / "studycore.db")
```

**Por qué `or ""` y no `os.getenv("KEY", default)`:** cuando `.env` tiene `DATABASE_PATH=` (vacío), `os.getenv` devuelve la cadena vacía `""`, no `None`, por lo que el default nunca se aplica. Con `or`, una cadena vacía colapsa al valor por defecto correctamente.

---

### 6.3 Inteligencia Artificial

#### Google Gemini Flash — `google-genai` SDK
Motor principal de IA. Se usa el modelo `models/gemini-flash-latest` para dos propósitos:

**1. Profesor IA (texto):**
- Recibe un system prompt con las reglas de comportamiento del profesor
- Historial de los últimos 10 mensajes como contexto de conversación
- Apuntes del estudiante (del cuaderno digital) como contexto adicional
- Temperatura 0.7 — respuestas variadas pero coherentes
- Max 2048 tokens de salida por respuesta

**2. OCR de manuscrito (visión):**
- Recibe la imagen en bytes con su MIME type
- Prompt específico para transcripción fiel de texto manuscrito en español
- Lee texto cursivo, diagramas, mapas conceptuales y fórmulas
- Responde únicamente con el texto transcrito

**Tier gratuito de Gemini:**
- 1,500 requests/día
- 15 requests/minuto
- 1,000,000 tokens/día
- Sin tarjeta de crédito

**Historial de modelos probados:**

| Modelo | Resultado |
|---|---|
| `gemini-2.0-flash` | 429 — límite de tier gratis = 0 requests |
| `gemini-2.5-flash` | 503 — UNAVAILABLE en el tier gratis |
| `gemini-flash-latest` | ✅ Funciona — modelo recomendado actualmente |

**SDK:** `google-genai` (paquete oficial nuevo). **No usar** `google-generativeai` — está deprecado y genera warnings.

```python
from google import genai
from google.genai import types

client = genai.Client(api_key=key)
response = client.models.generate_content(
    model="models/gemini-flash-latest",
    contents=[...],
    config=types.GenerateContentConfig(system_instruction=..., temperature=0.7)
)
```

---

### 6.4 OCR (Reconocimiento Óptico de Caracteres)

El sistema tiene 4 motores en cascada. Se intenta cada uno en orden; si falla, se pasa al siguiente:

#### Motor 1 — Gemini Vision (primario)
- **Tipo:** IA multimodal en la nube (gratuita)
- **Fortaleza:** único motor capaz de leer letra manuscrita cursiva en español con alta precisión, incluyendo diagramas, mapas conceptuales y fórmulas
- **Limitación:** requiere conexión a internet y la clave Gemini configurada
- **Confianza reportada:** 98%

#### Motor 2 — Claude Vision (secundario, opcional)
- **Tipo:** IA multimodal de Anthropic (requiere pago)
- **Fortaleza:** muy alta precisión para manuscrito
- **Limitación:** requiere `ANTHROPIC_API_KEY` con créditos — por defecto no disponible
- **Confianza reportada:** 99%

#### Motor 3 — EasyOCR (fallback local)
- **Tipo:** red neuronal de reconocimiento de texto, corre 100% local sin internet
- **Fortaleza:** funciona offline, bueno para texto impreso en español e inglés
- **Limitación:** baja precisión con letra cursiva (~12% en manuscrito español)
- **Implementación:** instancia singleton (`_easyocr_reader`) para no recargar el modelo en cada request
- **Idiomas:** `["es", "en"]`

#### Motor 4 — Tesseract (último recurso)
- **Tipo:** OCR clásico basado en patrones
- **Fortaleza:** muy estable, corre local, bueno para texto impreso perfectamente legible
- **Limitación:** no reconoce manuscrito; requiere instalación separada de Tesseract-OCR
- **Preprocessing:** la imagen se convierte a escala de grises, se aplica sharpening y mejora de contraste ×2.0, y se escala a mínimo 1000px de ancho

---

### 6.5 Desktop — Electron 33

Envuelve la app web en una ventana de escritorio nativa para Windows (y potencialmente macOS/Linux).

- **Ventana frameless** — la barra de título estándar del sistema operativo se oculta; StudyCore tiene su propio componente `TitleBar` con botones de minimizar, maximizar y cerrar
- **Backend embebido** — Electron arranca el servidor Flask de Python como proceso hijo al iniciar la app
- **Sin browser visible** — el usuario no necesita abrir Chrome ni Firefox; la app es autocontenida
- **CORS origins permitidos:** `http://localhost:3000`, `http://localhost:5173`, `app://.`, `file://`

---

### 6.6 Herramientas de Desarrollo

| Herramienta | Uso |
|---|---|
| `pip` + `requirements.txt` | Gestión de dependencias Python |
| `npm` + `package.json` | Gestión de dependencias JavaScript |
| `.env` + `python-dotenv` | Configuración de entorno (API keys, puertos) |
| `uuid` (stdlib Python) | Nombres únicos para archivos subidos en OCR (evita colisiones y problemas con tildes/espacios en nombres de archivo) |
| `werkzeug.utils.secure_filename` | Sanitización de nombres de archivo en uploads |
| `base64` (stdlib Python) | Encoding de imágenes para la API de Claude Vision |

---

### 6.7 Dependencias Python (requirements.txt)

```
flask>=3.0.0          # Framework web
flask-cors>=4.0.0     # Cabeceras CORS
python-dotenv>=1.0.0  # Variables de entorno
google-genai>=1.0.0   # SDK oficial de Google Gemini
easyocr>=1.7.0        # OCR local por deep learning
pytesseract>=0.3.10   # Wrapper de Tesseract
Pillow>=10.0.0        # Procesamiento de imágenes
```

### 6.8 Dependencias JavaScript (package.json frontend)

```
react / react-dom     # UI
react-router-dom      # Navegación entre páginas
axios                 # Cliente HTTP
lucide-react          # Iconos SVG
react-hot-toast       # Notificaciones
tailwindcss           # Estilos utility-first
vite                  # Build tool y dev server
@vitejs/plugin-react  # Plugin de React para Vite
electron              # Shell de escritorio
electron-builder      # Empaquetado para distribución
```

---

## 7. Funcionalidades por Módulo

### 6.1 Dashboard

**Estado:** Implementado

- Resumen del día: próximos eventos y evaluaciones
- Promedio general y por materia
- Acceso rápido a todas las secciones
- Contador de apuntes y materias activas

---

### 6.2 Cuaderno Digital

**Estado:** Implementado (rediseño v2 completo)

**Jerarquía de navegación:**

```
Materias (tarjetas)
  └── Períodos (Lapso 1, 2do Semestre…)
        └── Temas (Los Biomas, Derivadas…)
              └── Clases (fecha + apuntes + OCR)
```

**Reglas de negocio:**
- Cada materia tiene su propio cuaderno independiente
- Un período contiene típicamente 3–4 temas
- Un tema agrupa múltiples clases separadas por fecha
- Cada clase tiene: fecha, título opcional, contenido de texto libre
- Las clases pueden ser creadas manualmente o mediante OCR de foto

**OCR (digitalización de cuadernos físicos):**

| Motor | Tipo | Costo | Uso |
|---|---|---|---|
| Gemini Vision | Multimodal IA | Gratis (tier) | Primario — lee manuscrito, diagramas, mapas conceptuales |
| EasyOCR | Deep learning local | Gratis | Fallback — texto impreso en español/inglés |
| Tesseract | OCR clásico local | Gratis | Último recurso — solo texto impreso claro |

- El motor usado se muestra al usuario tras el procesamiento
- Se soportan formatos: JPG, PNG, WEBP, BMP, TIFF
- Tamaño máximo: 16 MB por imagen

**Requisitos de UX del cuaderno:**
- Navegación con breadcrumb en todo momento
- Botón "Atrás" para subir un nivel
- Crear/editar/eliminar en todos los niveles con confirmación en eliminaciones destructivas
- Editor de clase con: campo fecha, título opcional, textarea de contenido, botón OCR
- Las clases aparecen ordenadas por fecha (más reciente primero)
- Badge "OCR" visible en clases importadas por foto

---

### 6.3 Calendario Académico

**Estado:** Implementado

- Vista mensual con eventos marcados
- Tipos de evento: tarea, examen, recordatorio, clase
- Estados: pendiente, completado, perdido
- Asociación con materia (color del evento = color de la materia)
- Toggle de completado directamente desde el calendario

---

### 6.4 Evaluaciones y Calificaciones

**Estado:** Implementado

- Registro de evaluaciones por materia con peso porcentual
- Escala 0–20 (configurable)
- Cálculo automático de promedio ponderado por materia
- Cálculo de promedio general
- Indicador visual de aprobado (≥10) / reprobado (<10)
- Vista resumen con todas las materias y sus promedios

---

### 6.5 Profesor IA

**Estado:** Implementado (v2 con fuentes y comportamiento educativo)

**Comportamiento del profesor (reglas grabadas en el sistema):**

```
PUEDE:
✅ Explicar conceptos paso a paso con ejemplos cotidianos
✅ Crear mapas mentales y diagramas en texto
✅ Hacer resúmenes del material de estudio
✅ Corregir el trabajo del estudiante señalando el error exacto
✅ Explicar POR QUÉ algo está mal para evitar repetir el error
✅ Adaptar analogías a lo que le gusta al estudiante
✅ Usar diagramas de flujo, tablas comparativas, esquemas ASCII
✅ Terminar con preguntas que estimulen el pensamiento propio
✅ Celebrar cuando el estudiante llega a conclusiones por sí mismo

NO PUEDE:
🚫 Hacer la tarea o el examen por el estudiante
🚫 Dar la respuesta directa a ejercicios asignados
🚫 Resolver problemas de evaluación sin que el estudiante intente primero
```

**Sistema de Fuentes (contexto para el profesor):**

El profesor puede ser instruido con contexto de:

1. **Temas del cuaderno** — navegación tipo carpetas:
   - El estudiante navega: Materia → Período → Tema
   - Selecciona el tema relevante
   - El profesor recibe todos los apuntes de ese tema como contexto
   - Así el profesor "sabe qué se ha visto en clase" y personaliza la explicación

2. **Páginas web** — el estudiante pega una URL como referencia

3. **Videos** — el estudiante pega un link de YouTube u otro video

Múltiples fuentes pueden estar activas simultáneamente.

**Acciones rápidas predefinidas:**
- Explicar (con ejemplos cotidianos, sin tecnicismos)
- Mapa mental (en formato texto con ramas)
- Resumen (puntos clave del tema)
- Corregir (revisar trabajo y señalar errores)

**Conversaciones:**
- Persistencia en base de datos local
- Historial de los últimos 10 mensajes como contexto
- Título auto-generado desde la primera pregunta
- Organizadas por materia con color e icono

**Personalización de la IA:**
- El sistema prompt incluye el nombre de la materia
- Si se detectan preferencias del estudiante en el chat, se usan como analogías
- El objetivo explícito es que cada estudiante desarrolle su propia forma de pensar

---

### 6.6 Grupos de Estudio

**Estado:** Implementado (básico)

- Crear grupos públicos o privados
- Unirse por código de invitación
- Compartir notas dentro del grupo
- Tipos de contenido: nota, archivo, enlace

---

## 7. Módulos Futuros (Backlog)

| Módulo | Descripción | Prioridad |
|---|---|---|
| Modo examen | Quiz generado por la IA desde los apuntes del estudiante | Alta |
| Línea de tiempo | Vista cronológica de todos los temas vistos en el año | Media |
| Exportar PDF | Exportar cuaderno de una materia completa a PDF | Media |
| Estadísticas de estudio | Tiempo de sesión, temas más consultados, evolución de notas | Media |
| Perfil del estudiante | Intereses, estilo de aprendizaje, materias favoritas | Alta |
| Sincronización en la nube | Backup opcional en Google Drive | Baja |
| Modo colaborativo | Cuadernos compartidos entre compañeros | Baja |
| App móvil | Captura de fotos más cómoda desde el celular | Media |

---

## 8. Flujos de Usuario Principales

### Flujo 1 — Digitalizar apuntes de una clase

```
1. Abrir Cuaderno Digital
2. Seleccionar materia (ej: Biología)
3. Seleccionar o crear período (ej: Lapso 2)
4. Seleccionar o crear tema (ej: La Célula)
5. Clic en "Agregar clase"
6. Elegir fecha de la clase
7. Clic en "Importar foto (OCR)"
8. Seleccionar foto del cuaderno
9. Gemini Vision extrae el texto manuscrito
10. Revisar y ajustar si hay errores
11. Guardar
```

### Flujo 2 — Preguntarle al profesor sobre un tema

```
1. Abrir Profesor IA
2. Crear nueva conversación (o abrir una existente)
3. Clic en "Fuentes"
4. Navegar: Biología → Lapso 2 → La Célula
5. Seleccionar el tema como fuente
6. Escribir: "No entiendo qué diferencia hay entre célula animal y vegetal"
7. El profesor responde usando los apuntes del estudiante como contexto
8. Si el estudiante menciona que le gustan los videojuegos, el profesor usa esa analogía
```

### Flujo 3 — Registrar una evaluación

```
1. Abrir Evaluaciones
2. Seleccionar materia
3. Crear evaluación: "Parcial 1 — Biomas" / peso 30% / nota 15/20
4. El promedio se recalcula automáticamente
5. El dashboard muestra el promedio actualizado
```

---

## 9. Restricciones y Decisiones Técnicas

| Decisión | Razón |
|---|---|
| SQLite en lugar de PostgreSQL | App de escritorio local, un solo usuario, sin servidor |
| Gemini en lugar de Claude/OpenAI | Tier gratuito generoso (1500 req/día), sin tarjeta de crédito |
| `os.getenv("X") or default` en lugar de `os.getenv("X", default)` | `os.getenv` devuelve `""` cuando la var está en .env pero vacía; `or` colapsa ese caso al default |
| Sin ORM (raw sqlite3) | Menor complejidad, queries explícitas, sin migraciones pesadas |
| Conexiones SQLite por request | Evita problemas de threading con WAL; cada request abre/cierra su conexión |
| OCR con Gemini Vision como primario | Es el único motor capaz de leer manuscrito en español cursivo con alta precisión |
| `models/gemini-flash-latest` | `gemini-2.0-flash` devuelve 429 en tier gratis; `gemini-2.5-flash` devuelve 503; `flash-latest` funciona |

---

## 10. Variables de Entorno

```env
# Requerido
GEMINI_API_KEY=         # Gratis en aistudio.google.com/app/apikey

# Opcionales
FLASK_PORT=5000
FLASK_DEBUG=false
SECRET_KEY=             # Cambiar en producción
DATABASE_PATH=          # Por defecto: database/studycore.db
TESSERACT_CMD=          # Por defecto: C:\Program Files\Tesseract-OCR\tesseract.exe
OCR_LANG=spa+eng
```

---

## 11. Cómo Correr el Proyecto

**Backend:**
```bash
cd Study_proyect
python -m backend.app
# Corre en http://127.0.0.1:5000
```

**Frontend (desarrollo):**
```bash
cd Study_proyect/frontend
npm run dev
# Abre http://localhost:5173
```

**Build de escritorio:**
```bash
cd Study_proyect/frontend
npm run build
npm run electron:build
```

---

## 12. Métricas de Éxito

| Métrica | Objetivo |
|---|---|
| OCR de manuscrito en español | >85% de palabras correctas en fotos claras |
| Tiempo de respuesta del profesor IA | <5 segundos para respuestas simples |
| Tiempo de procesamiento OCR | <8 segundos por imagen |
| Navegación del cuaderno | Máximo 3 clics para llegar a cualquier clase |
| Carga inicial de la app | <2 segundos |

---

*StudyCore AI — Construido para que cada estudiante piense diferente.*
