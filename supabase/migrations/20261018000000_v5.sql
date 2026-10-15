-- ============================================================
-- Rotafy v5
--   1. Control de dónde se ficha (ubicación o wifi del local) y teletrabajo
--   2. Turnos partidos (una franja con dos tramos)
--   3. Avisos en el móvil (suscripciones push)
--   4. Varios encargados por local (invitaciones)
-- Se puede ejecutar sobre una base con datos: los conserva.
-- ============================================================

-- ---------- 1. Control de fichaje ----------
alter table public.locales
  add column fichaje_control text not null default 'no' check (fichaje_control in ('no', 'avisar', 'bloquear')),
  add column fichaje_lat double precision check (fichaje_lat between -90 and 90),
  add column fichaje_lng double precision check (fichaje_lng between -180 and 180),
  add column fichaje_radio_m smallint not null default 200 check (fichaje_radio_m between 50 and 2000),
  -- IP pública de la wifi del local (o varias si tiene más de una conexión).
  add column fichaje_ips text[] not null default '{}' check (cardinality(fichaje_ips) <= 5),
  add check ((fichaje_lat is null) = (fichaje_lng is null));

-- Días (0 = lunes … 6 = domingo) en que esa persona puede fichar desde cualquier sitio.
alter table public.empleados
  add column teletrabajo_dias smallint[] not null default '{}'
    check (teletrabajo_dias <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- Dónde se fichó. NUNCA se guardan coordenadas: solo el resultado y la distancia aproximada.
alter table public.fichajes
  add column ubicacion_entrada text check (ubicacion_entrada in ('local', 'fuera', 'sin_datos', 'teletrabajo')),
  add column ubicacion_salida text check (ubicacion_salida in ('local', 'fuera', 'sin_datos', 'teletrabajo')),
  add column distancia_entrada_m integer check (distancia_entrada_m >= 0),
  add column distancia_salida_m integer check (distancia_salida_m >= 0);

-- El servidor comprueba la ubicación (y bloquea si hace falta) y aquí solo se guarda el resultado.
drop function if exists public.fichar(text);
create function public.fichar(p_token text, p_ubicacion text default null, p_distancia integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e public.empleados;
  abierto public.fichajes;
  ultima timestamptz;
  olvidado boolean := false;
begin
  if p_ubicacion is not null and p_ubicacion not in ('local', 'fuera', 'sin_datos', 'teletrabajo') then
    raise exception 'Ubicación no válida';
  end if;
  select * into e from public.empleados where token_acceso = p_token and activo;
  if not found then raise exception 'Enlace no válido'; end if;
  if not (select fichaje_activo from public.locales where id = e.local_id) then
    raise exception 'El fichaje no está activado en este local';
  end if;

  select * into abierto from public.fichajes
  where empleado_id = e.id and salida is null and not sin_salida
  for update;

  if found then
    if now() - abierto.entrada > interval '16 hours' then
      update public.fichajes set sin_salida = true where id = abierto.id;
      olvidado := true;
    elsif now() - abierto.entrada < interval '1 minute' then
      return jsonb_build_object('estado', 'dentro', 'desde', abierto.entrada, 'olvidado', false);
    else
      update public.fichajes
      set salida = now(), ubicacion_salida = p_ubicacion, distancia_salida_m = p_distancia
      where id = abierto.id;
      return jsonb_build_object('estado', 'fuera', 'desde', abierto.entrada, 'hasta', now(), 'olvidado', false);
    end if;
  end if;

  select max(salida) into ultima from public.fichajes where empleado_id = e.id;
  if not olvidado and ultima is not null and now() - ultima < interval '1 minute' then
    return jsonb_build_object('estado', 'fuera', 'hasta', ultima, 'olvidado', false);
  end if;

  insert into public.fichajes (local_id, empleado_id, entrada, ubicacion_entrada, distancia_entrada_m)
  values (e.local_id, e.id, now(), p_ubicacion, p_distancia);
  return jsonb_build_object('estado', 'dentro', 'desde', now(), 'olvidado', olvidado);
end;
$$;
revoke execute on function public.fichar(text, text, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fichar(text, text, integer) to service_role;
  end if;
end $$;

-- Aviso al encargado cuando alguien ficha fuera del local.
create function public.aviso_fichaje_fuera()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  quien text;
  momento text;
  dist integer;
  dia date := (new.entrada at time zone 'Europe/Madrid')::date;
  lunes date := dia - (extract(isodow from dia)::int - 1);
begin
  if tg_op = 'INSERT' and new.ubicacion_entrada = 'fuera' then
    momento := 'la entrada'; dist := new.distancia_entrada_m;
  elsif tg_op = 'UPDATE' and new.ubicacion_salida = 'fuera' and old.ubicacion_salida is distinct from 'fuera' then
    momento := 'la salida'; dist := new.distancia_salida_m;
  else
    return new;
  end if;
  select nombre into quien from public.empleados where id = new.empleado_id;
  insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace)
  values (new.local_id, 'fichaje', quien || ' fichó ' || momento || ' fuera del local',
          case when dist is null then 'El ' || public.fecha_corta(dia) || '.'
               when dist >= 1000 then 'El ' || public.fecha_corta(dia) || ', a unos ' || replace(round(dist / 1000.0, 1)::text, '.', ',') || ' km.'
               else 'El ' || public.fecha_corta(dia) || ', a unos ' || dist || ' m.' end,
          '/app/fichajes?semana=' || lunes);
  return new;
end;
$$;
create trigger avisar_fichaje_fuera after insert or update of ubicacion_salida on public.fichajes
  for each row execute function public.aviso_fichaje_fuera();
revoke execute on function public.aviso_fichaje_fuera() from public, anon, authenticated;

-- ---------- 2. Turnos partidos ----------
alter table public.franjas
  add column inicio2 time,
  add column fin2 time,
  add check ((inicio2 is null) = (fin2 is null));

create or replace function public.guardar_franjas(p_franjas jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_local uuid;
  n int;
  nuevas text[];
begin
  select id into v_local from public.locales order by created_at limit 1;
  if v_local is null then raise exception 'Sin local'; end if;
  n := jsonb_array_length(coalesce(p_franjas, '[]'::jsonb));
  if n < 1 or n > 8 then raise exception 'Tiene que haber entre 1 y 8 franjas'; end if;

  select coalesce(array_agg(f ->> 'franja'), '{}') into nuevas
  from jsonb_array_elements(p_franjas) f
  where not exists (select 1 from public.franjas fr where fr.local_id = v_local and fr.franja = f ->> 'franja');

  insert into public.franjas (local_id, franja, etiqueta, inicio, fin, inicio2, fin2, horas, cierre, orden, activa)
  select v_local, f ->> 'franja', trim(f ->> 'etiqueta'), (f ->> 'inicio')::time, (f ->> 'fin')::time,
         nullif(f ->> 'inicio2', '')::time, nullif(f ->> 'fin2', '')::time,
         (f ->> 'horas')::numeric, coalesce((f ->> 'cierre')::boolean, false), (ord - 1)::smallint, true
  from jsonb_array_elements(p_franjas) with ordinality as x(f, ord)
  on conflict (local_id, franja) do update
    set etiqueta = excluded.etiqueta, inicio = excluded.inicio, fin = excluded.fin,
        inicio2 = excluded.inicio2, fin2 = excluded.fin2,
        horas = excluded.horas, cierre = excluded.cierre, orden = excluded.orden, activa = true;

  insert into public.disponibilidad (empleado_id, dia, franja)
  select e.id, d.dia, x.franja
  from public.empleados e
  cross join generate_series(0, 6) as d(dia)
  cross join unnest(nuevas) as x(franja)
  where e.local_id = v_local and e.activo
  on conflict do nothing;

  delete from public.disponibilidad d
  using public.empleados e
  where e.id = d.empleado_id and e.local_id = v_local
    and d.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f);
  update public.franjas fr set activa = false
  where fr.local_id = v_local
    and fr.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f)
    and exists (select 1 from public.turnos t join public.semanas s on s.id = t.semana_id
                where s.local_id = v_local and t.franja = fr.franja);
  delete from public.demanda dm
  where dm.local_id = v_local
    and dm.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f);
  delete from public.franjas fr
  where fr.local_id = v_local and fr.activa
    and fr.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f);
end;
$$;

create or replace function public.crear_local(p_nombre text, p_puestos jsonb, p_demanda jsonb, p_franjas jsonb default null)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
  v_franjas jsonb := coalesce(nullif(p_franjas, '[]'::jsonb), '[
    {"franja":"M","etiqueta":"Mañana","inicio":"09:00","fin":"17:00","horas":8,"cierre":false},
    {"franja":"T","etiqueta":"Tarde","inicio":"13:00","fin":"21:00","horas":8,"cierre":false},
    {"franja":"N","etiqueta":"Noche","inicio":"17:00","fin":"01:00","horas":8,"cierre":true}]'::jsonb);
begin
  if (select auth.uid()) is null then raise exception 'Sin sesión'; end if;
  if exists (select 1 from public.local_miembros where user_id = (select auth.uid())) then
    raise exception 'Ya gestionas un negocio';
  end if;
  insert into public.locales (owner_id, nombre) values ((select auth.uid()), p_nombre) returning id into v_id;

  insert into public.franjas (local_id, franja, etiqueta, inicio, fin, inicio2, fin2, horas, cierre, orden)
  select v_id, f ->> 'franja', f ->> 'etiqueta', (f ->> 'inicio')::time, (f ->> 'fin')::time,
         nullif(f ->> 'inicio2', '')::time, nullif(f ->> 'fin2', '')::time,
         (f ->> 'horas')::numeric, coalesce((f ->> 'cierre')::boolean, false), (ord - 1)::smallint
  from jsonb_array_elements(v_franjas) with ordinality as x(f, ord);

  insert into public.puestos (local_id, clave, nombre, color, orden)
  select v_id, p ->> 'clave', p ->> 'nombre', (p ->> 'color')::smallint, (ord - 1)::smallint
  from jsonb_array_elements(coalesce(p_puestos, '[]'::jsonb)) with ordinality as x(p, ord);

  insert into public.demanda (local_id, dia, franja, puesto, cantidad)
  select v_id, (d ->> 'dia')::smallint, d ->> 'franja', d ->> 'puesto', (d ->> 'cantidad')::smallint
  from jsonb_array_elements(coalesce(p_demanda, '[]'::jsonb)) as d;

  return v_id;
end;
$$;

-- ---------- 3. Avisos en el móvil ----------
create table public.push_suscripciones (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references public.locales (id) on delete cascade,
  empleado_id  uuid references public.empleados (id) on delete cascade, -- null = encargado
  usuario_id   uuid references auth.users (id) on delete cascade,      -- el encargado que la activó
  endpoint     text not null unique check (char_length(endpoint) <= 1000),
  p256dh       text not null check (char_length(p256dh) <= 200),
  auth         text not null check (char_length(auth) <= 100),
  creada_en    timestamptz not null default now()
);
create index on public.push_suscripciones (local_id) where empleado_id is null;
create index on public.push_suscripciones (empleado_id);
-- Sin políticas: solo el servidor (service role) las lee y escribe.
alter table public.push_suscripciones enable row level security;

alter table public.avisos add column push_en timestamptz;
-- Lo que ya había no se manda al móvil.
update public.avisos set push_en = now() where push_en is null;

-- El servidor recoge los avisos pendientes de mandar al móvil (cada uno, una sola vez).
create function public.tomar_avisos_push(p_limite integer default 100)
returns setof public.avisos
language sql security definer set search_path = ''
as $$
  update public.avisos a set push_en = now()
  where a.id in (
    select id from public.avisos
    where push_en is null and creado_en > now() - interval '1 day'
    order by creado_en
    limit greatest(1, least(p_limite, 500))
    for update skip locked)
  returning a.*;
$$;
revoke execute on function public.tomar_avisos_push(integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.tomar_avisos_push(integer) to service_role;
  end if;
end $$;

-- ---------- 4. Varios encargados ----------
-- El dueño sigue en locales.owner_id; aquí van los demás encargados.
create table public.local_miembros (
  local_id   uuid not null references public.locales (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text check (char_length(email) <= 320),
  creado_en  timestamptz not null default now(),
  primary key (local_id, user_id),
  unique (user_id) -- de momento, cada persona gestiona un solo negocio
);

create table public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references public.locales (id) on delete cascade,
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  creada_por  uuid references auth.users (id) on delete set null,
  creada_en   timestamptz not null default now(),
  expira_en   timestamptz not null default now() + interval '7 days',
  usada_por   uuid references auth.users (id) on delete set null,
  usada_en    timestamptz
);
create index on public.invitaciones (local_id);

-- Mi local: el que es mío o el que gestiono como encargado.
create or replace function public.es_mi_local(p_local_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.locales l
    where l.id = p_local_id and l.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.local_miembros m
    where m.local_id = p_local_id and m.user_id = (select auth.uid())
  );
$$;

-- Los encargados invitados ven y editan el local (borrarlo, solo el dueño).
create policy "encargados ven el local" on public.locales
  for select to authenticated using (public.es_mi_local(id));
create policy "encargados editan el local" on public.locales
  for update to authenticated using (public.es_mi_local(id)) with check (public.es_mi_local(id));

-- Nadie cambia el dueño de un local desde la app (un encargado invitado no
-- puede quedárselo poniéndose como dueño).
create function public.proteger_dueno()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede cambiar el dueño del negocio';
  end if;
  return new;
end;
$$;
create trigger locales_proteger_dueno before update of owner_id on public.locales
  for each row execute function public.proteger_dueno();

alter table public.local_miembros enable row level security;
create policy "ver encargados de mi local" on public.local_miembros
  for select to authenticated using (public.es_mi_local(local_id));
-- El dueño puede quitar a cualquiera; cada encargado puede irse.
create policy "quitar encargados" on public.local_miembros
  for delete to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.locales l where l.id = local_id and l.owner_id = (select auth.uid())));

alter table public.invitaciones enable row level security;
create policy "invitaciones de mi local" on public.invitaciones
  for select to authenticated using (public.es_mi_local(local_id));
create policy "crear invitaciones" on public.invitaciones
  for insert to authenticated with check (public.es_mi_local(local_id) and creada_por = (select auth.uid()));
create policy "borrar invitaciones" on public.invitaciones
  for delete to authenticated using (public.es_mi_local(local_id));

-- Aceptar una invitación (el email se toma de la cuenta, no de quien llama).
create function public.aceptar_invitacion(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitaciones;
  yo uuid := (select auth.uid());
  v_email text;
begin
  if yo is null then raise exception 'Sin sesión'; end if;
  select * into inv from public.invitaciones where token = p_token for update;
  if not found then raise exception 'Invitación no válida'; end if;
  if inv.usada_por is not null then raise exception 'Esta invitación ya se ha usado'; end if;
  if inv.expira_en < now() then raise exception 'Esta invitación ha caducado'; end if;
  if exists (select 1 from public.locales where owner_id = yo)
     or exists (select 1 from public.local_miembros where user_id = yo) then
    raise exception 'Ya gestionas un negocio';
  end if;
  select u.email into v_email from auth.users u where u.id = yo;
  insert into public.local_miembros (local_id, user_id, email) values (inv.local_id, yo, v_email);
  update public.invitaciones set usada_por = yo, usada_en = now() where id = inv.id;
  return inv.local_id;
end;
$$;
revoke execute on function public.aceptar_invitacion(text) from public, anon;
grant execute on function public.aceptar_invitacion(text) to authenticated;

-- Leer avisos: ahora vale para cualquier encargado del local.
create or replace function public.leer_avisos()
returns void
language sql security definer set search_path = ''
as $$
  update public.avisos a set leido_en = now()
  where a.empleado_id is null and a.leido_en is null and public.es_mi_local(a.local_id);
$$;

-- ---------- 5. Cargas con los campos nuevos ----------
create or replace function public.cargar_local()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with l as (
    select * from public.locales order by created_at limit 1
  )
  select case when not exists (select 1 from l) then null else jsonb_build_object(
    'local', (select jsonb_build_object(
        'id', id, 'nombre', nombre, 'max_noches_seguidas', max_noches_seguidas,
        'descanso_minimo_horas', descanso_minimo_horas, 'min_dias_libres', min_dias_libres,
        'horas_extra_max', horas_extra_max, 'fichaje_activo', fichaje_activo,
        'fichaje_margen_minutos', fichaje_margen_minutos,
        'fichaje_control', fichaje_control, 'fichaje_lat', fichaje_lat, 'fichaje_lng', fichaje_lng,
        'fichaje_radio_m', fichaje_radio_m, 'fichaje_ips', to_jsonb(fichaje_ips),
        'es_dueno', owner_id = (select auth.uid())) from l),
    'puestos', coalesce((
      select jsonb_agg(jsonb_build_object('clave', p.clave, 'nombre', p.nombre, 'color', p.color) order by p.orden, p.nombre)
      from public.puestos p join l on p.local_id = l.id), '[]'::jsonb),
    'empleados', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', e.id, 'nombre', e.nombre, 'puesto', e.puesto, 'horas_contrato', e.horas_contrato,
          'telefono', e.telefono, 'token_acceso', e.token_acceso, 'activo', e.activo,
          'min_dias_libres', e.min_dias_libres, 'max_cierres_seguidos', e.max_cierres_seguidos,
          'prefiere_librar', to_jsonb(e.prefiere_librar), 'teletrabajo_dias', to_jsonb(e.teletrabajo_dias),
          'disponibilidad', coalesce((
            select jsonb_agg(jsonb_build_object('empleado_id', d.empleado_id, 'dia', d.dia, 'franja', d.franja))
            from public.disponibilidad d where d.empleado_id = e.id), '[]'::jsonb)
        ) order by e.created_at)
      from public.empleados e join l on e.local_id = l.id where e.activo), '[]'::jsonb),
    'demanda', coalesce((
      select jsonb_agg(jsonb_build_object('dia', dm.dia, 'franja', dm.franja, 'puesto', dm.puesto, 'cantidad', dm.cantidad))
      from public.demanda dm join l on dm.local_id = l.id), '[]'::jsonb),
    'franjas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'franja', f.franja, 'etiqueta', f.etiqueta, 'inicio', f.inicio, 'fin', f.fin,
          'inicio2', f.inicio2, 'fin2', f.fin2, 'horas', f.horas,
          'cierre', f.cierre, 'orden', f.orden, 'activa', f.activa) order by f.activa desc, f.orden, f.franja)
      from public.franjas f join l on f.local_id = l.id), '[]'::jsonb)
  ) end;
$$;

create or replace function public.cargar_fichajes(p_desde date, p_hasta date)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_local uuid;
begin
  if p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'Periodo no válido'; end if;
  select id into v_local from public.locales order by created_at limit 1;
  if v_local is null then return null; end if;

  return jsonb_build_object(
    'fichajes', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', f.id, 'empleado_id', f.empleado_id, 'entrada', f.entrada, 'salida', f.salida,
          'sin_salida', f.sin_salida, 'origen', f.origen, 'editado', f.editado,
          'ubicacion_entrada', f.ubicacion_entrada, 'ubicacion_salida', f.ubicacion_salida,
          'distancia_entrada_m', f.distancia_entrada_m, 'distancia_salida_m', f.distancia_salida_m) order by f.entrada)
      from public.fichajes f
      where f.local_id = v_local
        and (f.entrada at time zone 'Europe/Madrid')::date between p_desde and p_hasta), '[]'::jsonb),
    'turnos', coalesce((
      select jsonb_agg(jsonb_build_object('empleado_id', t.empleado_id, 'fecha', s.fecha_inicio + t.dia, 'franja', t.franja))
      from public.turnos t join public.semanas s on s.id = t.semana_id
      where s.local_id = v_local and s.fecha_inicio + t.dia between p_desde and p_hasta), '[]'::jsonb),
    'archivados', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'puesto', e.puesto))
      from public.empleados e
      where e.local_id = v_local and not e.activo
        and exists (select 1 from public.fichajes f where f.empleado_id = e.id
                    and (f.entrada at time zone 'Europe/Madrid')::date between p_desde and p_hasta)), '[]'::jsonb),
    'cambios', coalesce((
      select jsonb_agg(jsonb_build_object(
          'fichaje_id', c.fichaje_id, 'empleado_id', c.empleado_id, 'accion', c.accion,
          'antes', c.antes, 'despues', c.despues, 'motivo', c.motivo, 'fecha', c.created_at) order by c.created_at)
      from public.fichajes_cambios c
      where c.local_id = v_local
        and (coalesce(c.despues ->> 'entrada', c.antes ->> 'entrada')::timestamptz at time zone 'Europe/Madrid')::date
            between p_desde and p_hasta), '[]'::jsonb)
  );
end;
$$;
