# Rotafy

Cuadrantes de turnos para negocios con turnos en España (hostelería, tiendas, residencias, gimnasios…): genera el horario semanal según la disponibilidad, las horas de contrato, las ausencias y las reglas de descanso, avisa de los conflictos y manda a cada persona su horario por WhatsApp con un enlace personal que también se suscribe al calendario del móvil.

## Qué hace

| Pantalla | Para quién | Qué permite |
|---|---|---|
| `/` | Visitantes | Portada con la propuesta y acceso a la demo |
| `/demo` | Cualquiera | Cuadrante de ejemplo, sin cuenta (no guarda nada) |
| `/login` | Encargado | Crear cuenta y entrar con email y contraseña |
| `/bienvenida` | Encargado | Crear el local y sus puestos (plantillas por sector o puestos propios) |
| `/app/cuadrante` | Encargado | Generar, retocar (se autoguarda, con deshacer), copiar la semana anterior, publicar, avisar por WhatsApp, aceptar cambios, imprimir |
| `/app/empleados` | Encargado | Equipo, horas de contrato, disponibilidad, ausencias (vacaciones, bajas, permisos) y enlace personal |
| `/app/necesidades` | Encargado | Cuánta gente hace falta por franja y puesto, y el horario de cada franja |
| `/app/ajustes` | Encargado | Nombre del local, reglas (descanso mínimo, días libres, cierres seguidos) y puestos con su color |
| `/h/<token>` | Empleado | Su horario publicado (móvil), pedir cambios y suscribirse al calendario, sin registrarse |
| `/h/<token>/calendario.ics` | Empleado | Calendario `.ics` que se actualiza solo (iPhone, Google, Outlook) |
| `/legal/*` | Todos | Privacidad y aviso legal |

## Puesta en marcha

### 1. Requisitos
Node.js 20 o superior y Git.

### 2. Instalar
```bash
git clone https://github.com/eloirey/turnio.git
cd turnio
npm install
```

### 3. Crear la base de datos (Supabase, gratis)
1. Crea un proyecto en [supabase.com](https://supabase.com). Elige una región de Europa.
2. Ve a **SQL Editor → New query** y ejecuta, **en este orden**, cada archivo de `supabase/migrations/` (pega el contenido y pulsa **Run**):
   1. `20261014000000_init.sql`
   2. `20261015000000_v2.sql` (puestos, ausencias, reglas y funciones de carga rápida). Se puede ejecutar sobre una base que ya tiene datos: los conserva.
3. En **Authentication → Sign In / Providers → Email**, mientras desarrollas puedes desactivar *Confirm email* para entrar sin confirmar el correo.
4. En **Authentication → URL Configuration**, pon `http://localhost:3000` como *Site URL* y añade `http://localhost:3000/auth/callback` a *Redirect URLs*.

### 4. Conectar la app
Copia `.env.example` a `.env.local` y rellena las tres claves (*Project Settings → API*):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

> La `SUPABASE_SERVICE_ROLE_KEY` salta la seguridad de la base de datos. Solo se usa en el servidor, para la vista del empleado. **Nunca la subas a GitHub** (`.env.local` ya está en `.gitignore`).

### 5. Arrancar
```bash
npm run dev      # http://localhost:3000
```

## Comandos

```bash
npm run dev        # desarrollo
npm test           # tests (generador, reglas, fechas, mapeos, WhatsApp, calendario)
npm run typecheck  # tipos
npm run lint       # estilo
npm run build      # compilación de producción
```

## Arquitectura

```
src/
  app/                       Rutas (App Router de Next.js)
    app/                     Zona del encargado (protegida)
      cuadrante/  empleados/  necesidades/  ajustes/   (page + componente cliente + actions)
    h/[token]/               Vista pública del empleado + calendario.ics
    login/  bienvenida/  auth/callback/  demo/  legal/
  components/
    cuadrante/               Cuadrícula editable + diálogo de avisos por WhatsApp
    feedback.tsx             Avisos (toasts) y confirmaciones
  lib/
    schedule/                Lógica pura: generador, reglas, validador (+ tests)
    data/
      mappers.ts             Filas de la BD ⇄ tipos del dominio (+ tests)
      queries.ts             Lecturas del encargado (con su sesión → RLS)
      employee-view.ts       Lecturas de la vista del empleado (cliente admin)
    supabase/                Clientes: navegador, servidor y admin
    dates.ts  whatsapp.ts  messages.ts  roles.ts  ics.ts
  proxy.ts                   Refresca la sesión y protege /app
supabase/
  migrations/                Esquema, seguridad (RLS) y funciones atómicas
  tests/                     Pruebas SQL de seguridad y funciones
```

### Decisiones clave

- **La lógica no sabe nada de la base de datos.** `lib/schedule` recibe datos y devuelve cuadrantes. Por eso se testea sola y se reutiliza en la demo.
- **Seguridad en la base de datos, no solo en el código.** Cada tabla tiene políticas RLS: aunque hubiera un fallo en la app, un encargado no puede leer ni tocar datos de otro local.
- **Operaciones atómicas en SQL.** `guardar_cuadrante`, `publicar_semana` y `aceptar_solicitud` hacen todo o nada, así nunca queda un cuadrante a medias.
- **Una consulta por pantalla.** `cargar_local` y `cargar_semana` traen todo lo que necesita cada pantalla en un solo viaje a la base de datos (importa cuando el servidor y la base están lejos).
- **Reglas laborales reales.** El descanso entre jornadas se calcula con las horas de verdad de cada turno (también los que acaban pasada la medianoche).
- **Lo publicado es una copia.** Al publicar se guarda una foto del cuadrante (`semanas.publicado`). El encargado puede seguir retocando sin que el equipo vea cambios a medias hasta que vuelva a publicar.
- **WhatsApp sin API.** Enlaces `wa.me` con el mensaje ya escrito: gratis y sin trámites con Meta.
- **Empleados sin cuenta.** Cada uno tiene un enlace con un token aleatorio de 128 bits. La página no se indexa en buscadores.

## Probar la base de datos sin Supabase

Si tienes PostgreSQL instalado:

```bash
createdb rotafy_test
psql -d rotafy_test -f supabase/tests/00_stub_supabase.sql
psql -d rotafy_test -f supabase/migrations/20261014000000_init.sql
psql -d rotafy_test -f supabase/migrations/20261015000000_v2.sql
psql -d rotafy_test -f supabase/tests/10_rls_y_funciones.sql   # debe terminar en "TODAS LAS PRUEBAS ... PASAN"
psql -d rotafy_test -f supabase/tests/20_v2.sql
```

## Hoja de ruta

- [x] Generador, reglas y avisos
- [x] Login, local, empleados, necesidades
- [x] Cuadrante guardado, publicación y avisos por WhatsApp
- [x] Vista móvil del empleado y solicitudes de cambio
- [x] Puestos propios, ausencias, reglas configurables y calendario del móvil
- [ ] Rellenar los datos del titular en `src/app/legal/` (buscar `[NOMBRE Y APELLIDOS]`, `[NIF]`, `[DIRECCIÓN]`, `[EMAIL DE CONTACTO]`, `[FECHA]`)
- [ ] Desplegar en Netlify con el dominio rotafy.es (añadir las 3 variables de entorno y `NEXT_PUBLIC_SITE_URL=https://rotafy.es`)
- [ ] Probar una semana con un bar real
- [ ] Pagos con Stripe cuando haya interesados
- [ ] Registro de jornada (fichar entrada y salida)
