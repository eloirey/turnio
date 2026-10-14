-- ============================================================
-- Turnio · esquema inicial
-- Convenciones:
--   dia:    0 = lunes … 6 = domingo (igual que en src/lib/schedule)
--   franja: 'M' mañana, 'T' tarde, 'N' noche
--   Un día libre NO tiene fila en `turnos` (ausencia = libre).
-- ============================================================

-- ---------- Locales (un encargado puede tener varios) ----------
create table public.locales (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users (id) on delete cascade,
  nombre                 text not null check (char_length(nombre) between 1 and 120),
  max_noches_seguidas    smallint not null default 2 check (max_noches_seguidas between 1 and 7),
  prohibir_noche_manana  boolean not null default true,
  created_at             timestamptz not null default now()
);
create index on public.locales (owner_id);

-- ---------- Franjas configurables por local ----------
create table public.franjas (
  local_id  uuid not null references public.locales (id) on delete cascade,
  franja    char(1) not null check (franja in ('M', 'T', 'N')),
  etiqueta  text not null,
  inicio    time not null,
  fin       time not null,               -- puede ser menor que inicio (cruza medianoche)
  horas     numeric(4, 2) not null check (horas > 0 and horas <= 16),
  primary key (local_id, franja)
);

-- ---------- Empleados ----------
create table public.empleados (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references public.locales (id) on delete cascade,
  nombre          text not null check (char_length(nombre) between 1 and 80),
  puesto          text not null check (char_length(puesto) between 1 and 40),
  horas_contrato  smallint not null check (horas_contrato between 1 and 60),
  telefono        text,
  -- Enlace personal del empleado (turnio.app/h/<token>), sin cuenta.
  token_acceso    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on public.empleados (local_id);

-- ---------- Disponibilidad: una fila = "puede trabajar esa franja ese día" ----------
create table public.disponibilidad (
  empleado_id  uuid not null references public.empleados (id) on delete cascade,
  dia          smallint not null check (dia between 0 and 6),
  franja       char(1) not null check (franja in ('M', 'T', 'N')),
  primary key (empleado_id, dia, franja)
);

-- ---------- Demanda: cuánta gente de cada puesto hace falta ----------
create table public.demanda (
  local_id  uuid not null references public.locales (id) on delete cascade,
  dia       smallint not null check (dia between 0 and 6),
  franja    char(1) not null check (franja in ('M', 'T', 'N')),
  puesto    text not null,
  cantidad  smallint not null check (cantidad between 1 and 50),
  primary key (local_id, dia, franja, puesto)
);

-- ---------- Semanas (un cuadrante por local y semana) ----------
create table public.semanas (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references public.locales (id) on delete cascade,
  fecha_inicio  date not null check (extract(isodow from fecha_inicio) = 1), -- siempre lunes
  estado        text not null default 'borrador' check (estado in ('borrador', 'publicado', 'cambios')),
  publicado_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (local_id, fecha_inicio)
);

-- ---------- Turnos asignados ----------
create table public.turnos (
  semana_id    uuid not null references public.semanas (id) on delete cascade,
  empleado_id  uuid not null references public.empleados (id) on delete cascade,
  dia          smallint not null check (dia between 0 and 6),
  franja       char(1) not null check (franja in ('M', 'T', 'N')),
  primary key (semana_id, empleado_id, dia)   -- un turno por persona y día
);

-- ---------- Solicitudes de cambio ----------
create table public.solicitudes (
  id               uuid primary key default gen_random_uuid(),
  semana_id        uuid not null references public.semanas (id) on delete cascade,
  empleado_id      uuid not null references public.empleados (id) on delete cascade,
  tipo             text not null check (tipo in ('librar', 'intercambio')),
  dia              smallint not null check (dia between 0 and 6),
  con_empleado_id  uuid references public.empleados (id) on delete set null,
  mensaje          text check (char_length(mensaje) <= 500),
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  created_at       timestamptz not null default now(),
  check (tipo <> 'intercambio' or con_empleado_id is not null)
);
create index on public.solicitudes (semana_id, estado);

-- ============================================================
-- Seguridad (Row Level Security)
-- Regla única: un encargado solo ve y toca datos de SUS locales.
-- Los empleados NO usan estas políticas: su vista por token se sirve
-- desde el servidor con la service role key (nunca en el navegador).
-- ============================================================

create function public.es_mi_local(p_local_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.locales l
    where l.id = p_local_id and l.owner_id = (select auth.uid())
  );
$$;

alter table public.locales        enable row level security;
alter table public.franjas        enable row level security;
alter table public.empleados      enable row level security;
alter table public.disponibilidad enable row level security;
alter table public.demanda        enable row level security;
alter table public.semanas        enable row level security;
alter table public.turnos         enable row level security;
alter table public.solicitudes    enable row level security;

create policy "propios locales" on public.locales
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "franjas de mis locales" on public.franjas
  for all to authenticated
  using (public.es_mi_local(local_id)) with check (public.es_mi_local(local_id));

create policy "empleados de mis locales" on public.empleados
  for all to authenticated
  using (public.es_mi_local(local_id)) with check (public.es_mi_local(local_id));

create policy "demanda de mis locales" on public.demanda
  for all to authenticated
  using (public.es_mi_local(local_id)) with check (public.es_mi_local(local_id));

create policy "semanas de mis locales" on public.semanas
  for all to authenticated
  using (public.es_mi_local(local_id)) with check (public.es_mi_local(local_id));

create policy "disponibilidad de mis empleados" on public.disponibilidad
  for all to authenticated
  using (exists (select 1 from public.empleados e where e.id = empleado_id and public.es_mi_local(e.local_id)))
  with check (exists (select 1 from public.empleados e where e.id = empleado_id and public.es_mi_local(e.local_id)));

create policy "turnos de mis semanas" on public.turnos
  for all to authenticated
  using (exists (select 1 from public.semanas s where s.id = semana_id and public.es_mi_local(s.local_id)))
  with check (
    exists (select 1 from public.semanas s where s.id = semana_id and public.es_mi_local(s.local_id))
    and exists (select 1 from public.empleados e where e.id = empleado_id and public.es_mi_local(e.local_id))
  );

create policy "solicitudes de mis semanas" on public.solicitudes
  for all to authenticated
  using (exists (select 1 from public.semanas s where s.id = semana_id and public.es_mi_local(s.local_id)))
  with check (exists (select 1 from public.semanas s where s.id = semana_id and public.es_mi_local(s.local_id)));

-- ============================================================
-- Al crear un local, se crean sus 3 franjas por defecto.
-- ============================================================
create function public.crear_franjas_por_defecto()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.franjas (local_id, franja, etiqueta, inicio, fin, horas) values
    (new.id, 'M', 'Mañana', '09:00', '17:00', 8),
    (new.id, 'T', 'Tarde',  '13:00', '21:00', 8),
    (new.id, 'N', 'Noche',  '17:00', '01:00', 8);
  return new;
end;
$$;

create trigger locales_franjas_por_defecto
  after insert on public.locales
  for each row execute function public.crear_franjas_por_defecto();
