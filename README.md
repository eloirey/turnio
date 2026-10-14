# Turnio

Cuadrantes de turnos para hostelería pequeña: genera el horario semanal según la disponibilidad y las horas de contrato de cada empleado, avisa de los conflictos y manda a cada uno su horario con un enlace.

## Arrancar en local

```bash
npm install
npm run dev        # http://localhost:3000  → la demo está en /demo
npm test           # tests del generador
npm run typecheck  # comprobación de tipos
```

## Estructura

```
src/
  app/
    page.tsx              Portada
    demo/page.tsx         Demo del cuadrante con datos de ejemplo
  components/
    cuadrante/Cuadrante.tsx   Cuadrícula editable, avisos y cobertura
  lib/
    schedule/             Lógica de cuadrantes (pura, sin React ni base de datos)
      types.ts            Tipos del dominio
      rules.ts            Reglas (noches seguidas, noche→mañana)
      generator.ts        Generador automático
      validate.ts         Huecos, conflictos y horas
      schedule.test.ts    Tests
    supabase/             Clientes de Supabase (navegador y servidor)
supabase/
  migrations/             Esquema SQL con seguridad por filas (RLS)
```

**Regla del proyecto:** la lógica de negocio vive en `src/lib/schedule` y no sabe nada de React ni de Supabase. Así se puede testear sola y reutilizar en el servidor.

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pega y ejecuta `supabase/migrations/20261014000000_init.sql`.
3. Copia `.env.example` a `.env.local` y rellena las claves (Project Settings → API).

> La `SUPABASE_SERVICE_ROLE_KEY` salta la seguridad por filas: úsala solo en el servidor (por ejemplo, para la vista del empleado por token) y no la subas nunca a GitHub.

## Convenciones

- Días: `0` = lunes … `6` = domingo.
- Franjas: `M` mañana, `T` tarde, `N` noche. Un día libre no tiene fila en `turnos`.
- Colores y tipografías: tokens en `src/app/globals.css` (`bg-accent`, `text-ink`, `bg-sala`…).

## Hoja de ruta

- [x] Generador + tests, esquema SQL, demo del cuadrante
- [ ] Semana 1 — Login del encargado y pantalla de Empleados conectada a Supabase
- [ ] Semana 2 — Guardar y cargar semanas reales
- [ ] Semana 3 — Publicar (enlace por WhatsApp) y vista móvil del empleado
- [ ] Semana 4 — Solicitudes de cambio, despliegue en Vercel y primer bar de prueba
