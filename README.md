# Rotafy

Cuadrantes de turnos para negocios con turnos en España (hostelería, tiendas, residencias, gimnasios…): genera el horario semanal según la disponibilidad, las horas de contrato, las ausencias y las reglas de descanso, avisa de los conflictos y manda a cada persona su horario por WhatsApp con un enlace personal que también se suscribe al calendario del móvil.

## Qué hace

| Pantalla | Para quién | Qué permite |
|---|---|---|
| `/` | Visitantes | Portada con la propuesta y acceso a la demo |
| `/demo` | Cualquiera | La app completa con un negocio de ejemplo y una guía paso a paso (no guarda nada) |
| `/login` | Encargado | Crear cuenta y entrar con email y contraseña |
| `/login`, `/recuperar`, `/nueva-contrasena` | Encargado | Entrar con email o Google, y recuperar la contraseña |
| `/bienvenida` | Encargado | Crear el negocio desde una de las 17 plantillas por sector (puestos, franjas y necesidades) |
| `/app/cuadrante` | Encargado | Generar, retocar (se autoguarda, con deshacer), copiar la semana anterior, publicar, avisar por WhatsApp, aceptar cambios, imprimir. Si el local ficha, debajo de cada turno se ve la hora real de entrada y salida |
| `/app/fichajes` | Encargado | Registro de jornada: quién trabaja ahora, horas por persona y día, incidencias (olvidos, turnos sin fichar), correcciones con motivo e historial, exportar el mes a Excel |
| `/app/empleados` | Encargado | Equipo, horas de contrato, disponibilidad, preferencias y reglas propias, ausencias y enlace personal |
| `/app/necesidades` | Encargado | Cuánta gente hace falta por franja y puesto, y las franjas (nombre libre, horario, orden, cierres) |
| `/app/ajustes` | Encargado | Nombre, reglas (descanso, días libres, cierres seguidos, horas extra), fichaje, puestos y borrar la cuenta |
| `/h/<nombre>-<token>` | Empleado | Su horario, fichar entrada y salida, pedir cambios y suscribirse al calendario, sin registrarse |
| `/h/<nombre>-<token>/calendario.ics` | Empleado | Calendario `.ics` que se actualiza solo (iPhone, Google, Outlook) |
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
   2. `20261015000000_v2.sql` (puestos, ausencias, reglas y funciones de carga rápida).
   3. `20261016000000_v3.sql` (franjas con nombre libre, reglas por persona, horas extra y fichajes).

   Se pueden ejecutar sobre una base que ya tiene datos: los conservan.
3. En **Authentication → Sign In / Providers → Email**, mientras desarrollas puedes desactivar *Confirm email* para entrar sin confirmar el correo.
4. En **Authentication → URL Configuration**, pon `http://localhost:3000` como *Site URL* y añade `http://localhost:3000/auth/callback` a *Redirect URLs* (en producción, también `https://rotafy.es/auth/callback`).
5. **Emails** (confirmar cuenta y recuperar contraseña): el servicio de email que trae Supabase solo envía a los miembros de tu equipo de Supabase y 2 por hora. Para clientes reales configura un SMTP propio en **Authentication → Emails → SMTP Settings** (por ejemplo, Resend).

#### Entrar con Google (opcional)
1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto → **APIs y servicios → Pantalla de consentimiento** (tipo *Externo*) → **Credenciales → Crear credenciales → ID de cliente OAuth** (*Aplicación web*).
2. En *URIs de redirección autorizados* pon la que te enseña Supabase en **Authentication → Sign In / Providers → Google** (`https://<tu-proyecto>.supabase.co/auth/v1/callback`).
3. Copia el *Client ID* y el *Client secret* en ese mismo apartado de Supabase y activa Google.
4. Añade `NEXT_PUBLIC_AUTH_GOOGLE=1` a las variables de entorno (en local y en Netlify). Sin ella, el botón no aparece.

### 4. Conectar la app
Copia `.env.example` a `.env.local` y rellena las tres claves (*Project Settings → API*):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://rotafy.es   # en producción
NEXT_PUBLIC_AUTH_GOOGLE=1                # solo si has configurado Google
```

> La `SUPABASE_SERVICE_ROLE_KEY` salta la seguridad de la base de datos. Solo se usa en el servidor, para la vista del empleado. **Nunca la subas a GitHub** (`.env.local` ya está en `.gitignore`).

### 5. Arrancar
```bash
npm run dev      # http://localhost:3000
```

## Comandos

```bash
npm run dev        # desarrollo
npm test           # tests (generador, plantillas, reglas, fichajes, fechas, mapeos, WhatsApp, calendario)
npm run typecheck  # tipos
npm run lint       # estilo
npm run build      # compilación de producción
```

## Arquitectura

```
src/
  app/                       Rutas (App Router de Next.js)
    app/                     Zona del encargado (protegida)
      cuadrante/  fichajes/  empleados/  necesidades/  ajustes/   (page + componente cliente + actions)
    h/[token]/               Vista pública del empleado (horario, fichar) + calendario.ics
    login/  recuperar/  nueva-contrasena/  bienvenida/  auth/callback/  demo/  legal/
  components/
    cuadrante/               Cuadrícula editable + diálogo de avisos por WhatsApp
    feedback.tsx             Avisos (toasts) y confirmaciones
    nav.tsx                  Enlaces que en la demo cambian de pestaña en vez de navegar
  lib/
    schedule/                Lógica pura: generador, reglas, validador (+ tests)
    data/
      mappers.ts             Filas de la BD ⇄ tipos del dominio (+ tests)
      queries.ts             Lecturas del encargado (con su sesión → RLS)
      employee-view.ts       Lecturas de la vista del empleado (cliente admin)
    supabase/                Clientes: navegador, servidor y admin
    schedule/templates.ts    Plantillas por sector (puestos, franjas, necesidades, equipo de ejemplo)
    fichajes.ts              Horas de Madrid, estado de cada día, CSV del registro de jornada (+ tests)
    forms.ts                 Validación compartida por el servidor y la demo
    dates.ts  whatsapp.ts  messages.ts  roles.ts  ics.ts  employee-link.ts
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
- **Reglas laborales reales.** El descanso entre jornadas se calcula con las horas de verdad de cada turno (también los que acaban pasada la medianoche). Cada persona puede tener sus propias reglas y días que prefiere librar.
- **Franjas libres.** Cada franja tiene un código interno que no cambia (`M`, `L12`, `F1`…) y un nombre que se puede cambiar. Las que se quitan pero ya salen en cuadrantes antiguos se archivan, no se borran.
- **Generador con varias pasadas.** Prueba varias estrategias y se queda con la que deja menos huecos y reparte mejor las horas; siempre da el mismo resultado para los mismos datos.
- **Fichajes fiables.** La hora la pone la base de datos, no el móvil. El encargado no puede escribir fichajes directamente: solo a través de funciones que guardan cada cambio con su motivo (`fichajes_cambios`). Quien deja el equipo se archiva para conservar su registro (la ley obliga a guardarlo 4 años).
- **La demo es la app de verdad.** Usa los mismos componentes; solo cambian las acciones, que guardan en memoria.
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
psql -d rotafy_test -f supabase/migrations/20261016000000_v3.sql
psql -d rotafy_test -f supabase/tests/10_rls_y_funciones.sql   # debe terminar en "TODAS LAS PRUEBAS ... PASAN"
psql -d rotafy_test -f supabase/tests/20_v2.sql
psql -d rotafy_test -f supabase/tests/30_v3.sql                # "TODAS LAS PRUEBAS DE v3 PASAN"
```

## Hoja de ruta

- [x] Generador, reglas y avisos
- [x] Login, local, empleados, necesidades
- [x] Cuadrante guardado, publicación y avisos por WhatsApp
- [x] Vista móvil del empleado y solicitudes de cambio
- [x] Puestos propios, ausencias, reglas configurables y calendario del móvil
- [x] Fichajes, franjas libres, plantillas por sector, Google, recuperar contraseña y demo guiada
- [ ] Rellenar los datos del titular en `src/app/legal/` (buscar `[NOMBRE Y APELLIDOS]`, `[NIF]`, `[DIRECCIÓN]`, `[EMAIL DE CONTACTO]`, `[FECHA]`)
- [ ] Desplegar en Netlify con el dominio rotafy.es (añadir las 3 variables de entorno y `NEXT_PUBLIC_SITE_URL=https://rotafy.es`)
- [ ] Probar una semana con un bar real
- [ ] Pagos con Stripe cuando haya interesados
- [ ] Registro de jornada (fichar entrada y salida)
