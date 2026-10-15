-- ============================================================
-- Rotafy · v3
--   1. Franjas libres: cada local crea, renombra y ordena las suyas
--      ("Mañana", "Línea 12", "Partido"…) y marca cuáles son cierres.
--   2. Más reglas: horas extra por local y reglas propias de cada persona
--      (días libres, cierres seguidos y días que prefiere librar).
--   3. Fichajes (registro de jornada) con historial de cambios.
--   4. Cargas rápidas y operaciones atómicas actualizadas.
-- Se ejecuta DESPUÉS de 20261015000000_v2.sql. Conserva todos los datos.
-- ============================================================

-- ---------- 1. Franjas libres ----------
-- Las columnas "franja" dejan de ser solo M/T/N: ahora son un código corto.
do $$
declare r record;
begin
  for r in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and con.contype = 'c'
      and rel.relname in ('franjas', 'disponibilidad', 'demanda', 'turnos')
      and pg_get_constraintdef(con.oid) like '%franja%'
  loop
    execute format('alter table public.%I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;

alter table public.franjas        alter column franja type text;
alter table public.disponibilidad alter column franja type text;
alter table public.demanda        alter column franja type text;
alter table public.turnos         alter column franja type text;

-- Código: letras y números, sin espacios; "L" queda reservado para "Libre".
alter table public.franjas
  add constraint franjas_codigo check (franja ~ '^[A-Za-z0-9]{1,8}$' and franja <> 'L'),
  add constraint franjas_etiqueta check (char_length(etiqueta) between 1 and 30),
  add column orden  smallint not null default 0,
  add column cierre boolean  not null default false,  -- cuenta para "cierres seguidos"
  add column activa boolean  not null default true;   -- las archivadas se conservan por el historial

update public.franjas set orden = case franja when 'M' then 0 when 'T' then 1 when 'N' then 2 else 9 end;
update public.franjas set cierre = true where franja = 'N';

-- La demanda solo puede usar franjas del local (y desaparece con ellas).
alter table public.demanda
  add constraint demanda_franja_fk foreign key (local_id, franja)
  references public.franjas (local_id, franja) on update cascade on delete cascade;

-- Las franjas ya no se crean con un disparador: las crea crear_local (plantillas).
drop trigger if exists locales_franjas_por_defecto on public.locales;
drop function if exists public.crear_franjas_por_defecto();

-- ---------- 2. Más reglas ----------
alter table public.locales
  add column horas_extra_max smallint not null default 0 check (horas_extra_max between 0 and 20),
  add column fichaje_activo boolean not null default false,
  add column fichaje_margen_minutos smallint not null default 10 check (fichaje_margen_minutos between 0 and 60);

alter table public.empleados
  add column min_dias_libres smallint check (min_dias_libres between 0 and 6),          -- null = la del local
  add column max_cierres_seguidos smallint check (max_cierres_seguidos between 1 and 7), -- null = la del local
  add column prefiere_librar smallint[] not null default '{}'
    check (prefiere_librar <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- ---------- 3. Fichajes ----------
-- Una fila = un tramo trabajado. Si alguien olvida fichar la salida, el tramo
-- se marca "sin_salida" (cuenta 0 horas) hasta que el encargado lo corrige.
create table public.fichajes (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references public.locales (id) on delete cascade,
  empleado_id  uuid not null references public.empleados (id) on delete cascade,
  entrada      timestamptz not null,
  salida       timestamptz,
  sin_salida   boolean not null default false,
  origen       text not null default 'empleado' check (origen in ('empleado', 'encargado')),
  editado      boolean not null default false,
  created_at   timestamptz not null default now(),
  check (salida is null or salida > entrada),
  check (salida is null or salida - entrada <= interval '24 hours'),
  check (not (sin_salida and salida is not null))
);
create index on public.fichajes (local_id, entrada);
create index on public.fichajes (empleado_id, entrada);
-- Como mucho un tramo abierto por persona.
create unique index fichajes_un_abierto on public.fichajes (empleado_id) where salida is null and not sin_salida;

-- Historial: cada cambio del encargado queda registrado con su motivo.
create table public.fichajes_cambios (
  id           bigint generated always as identity primary key,
  local_id     uuid not null references public.locales (id) on delete cascade,
  fichaje_id   uuid not null,          -- sin FK: el historial se conserva aunque se borre el fichaje
  empleado_id  uuid not null,
  accion       text not null check (accion in ('crear', 'editar', 'borrar')),
  antes        jsonb,
  despues      jsonb,
  motivo       text not null check (char_length(motivo) between 2 and 300),
  autor        uuid,
  created_at   timestamptz not null default now()
);
create index on public.fichajes_cambios (local_id, created_at);

alter table public.fichajes enable row level security;
alter table public.fichajes_cambios enable row level security;
-- El encargado solo LEE. Los cambios pasan por guardar_fichaje / borrar_fichaje,
-- que siempre dejan constancia en el historial.
create policy "ver fichajes de mis locales" on public.fichajes
  for select to authenticated using (public.es_mi_local(local_id));
create policy "ver cambios de mis locales" on public.fichajes_cambios
  for select to authenticated using (public.es_mi_local(local_id));

-- ---------- Funciones de fichaje ----------

-- El empleado ficha desde su enlace (lo llama el servidor con la service role).
-- La hora es SIEMPRE la del servidor: el móvil no puede adelantarla ni atrasarla.
create function public.fichar(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e public.empleados;
  abierto public.fichajes;
  ultima timestamptz;
  olvidado boolean := false;
begin
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
      -- Se olvidó de fichar la salida: ese tramo queda pendiente de revisar y empieza uno nuevo.
      update public.fichajes set sin_salida = true where id = abierto.id;
      olvidado := true;
    elsif now() - abierto.entrada < interval '1 minute' then
      -- Doble toque: no cerramos un tramo de segundos.
      return jsonb_build_object('estado', 'dentro', 'desde', abierto.entrada, 'olvidado', false);
    else
      update public.fichajes set salida = now() where id = abierto.id;
      return jsonb_build_object('estado', 'fuera', 'desde', abierto.entrada, 'hasta', now(), 'olvidado', false);
    end if;
  end if;

  select max(salida) into ultima from public.fichajes where empleado_id = e.id;
  if not olvidado and ultima is not null and now() - ultima < interval '1 minute' then
    return jsonb_build_object('estado', 'fuera', 'hasta', ultima, 'olvidado', false);
  end if;

  insert into public.fichajes (local_id, empleado_id, entrada) values (e.local_id, e.id, now());
  return jsonb_build_object('estado', 'dentro', 'desde', now(), 'olvidado', olvidado);
end;
$$;

-- El encargado crea o corrige un tramo (p_id null = nuevo). Exige motivo.
create function public.guardar_fichaje(p_id uuid, p_empleado uuid, p_entrada timestamptz, p_salida timestamptz, p_motivo text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_local uuid;
  viejo public.fichajes;
  nuevo public.fichajes;
begin
  if (select auth.uid()) is null then raise exception 'Sin sesión'; end if;
  select local_id into v_local from public.empleados where id = p_empleado;
  if v_local is null or not public.es_mi_local(v_local) then raise exception 'Empleado no encontrado'; end if;
  if p_motivo is null or char_length(trim(p_motivo)) < 2 then raise exception 'Indica el motivo del cambio'; end if;
  if p_entrada is null then raise exception 'Falta la hora de entrada'; end if;
  if p_salida is not null and p_salida <= p_entrada then raise exception 'La salida tiene que ser posterior a la entrada'; end if;
  if p_salida is not null and p_salida - p_entrada > interval '24 hours' then raise exception 'Un tramo no puede durar más de 24 horas'; end if;
  if p_entrada > now() + interval '5 minutes' or p_salida > now() + interval '5 minutes' then
    raise exception 'No se pueden registrar horas futuras';
  end if;
  if exists (
    select 1 from public.fichajes f
    where f.empleado_id = p_empleado and f.id is distinct from p_id and not f.sin_salida
      and tstzrange(f.entrada, coalesce(f.salida, 'infinity')) && tstzrange(p_entrada, coalesce(p_salida, 'infinity'))
  ) then
    raise exception 'Se solapa con otro tramo de esta persona';
  end if;

  if p_id is null then
    insert into public.fichajes (local_id, empleado_id, entrada, salida, origen, editado)
    values (v_local, p_empleado, p_entrada, p_salida, 'encargado', true)
    returning * into nuevo;
    insert into public.fichajes_cambios (local_id, fichaje_id, empleado_id, accion, antes, despues, motivo, autor)
    values (v_local, nuevo.id, p_empleado, 'crear', null,
            jsonb_build_object('entrada', nuevo.entrada, 'salida', nuevo.salida), trim(p_motivo), (select auth.uid()));
    return nuevo.id;
  end if;

  select * into viejo from public.fichajes where id = p_id and empleado_id = p_empleado for update;
  if not found then raise exception 'Fichaje no encontrado'; end if;
  update public.fichajes
  set entrada = p_entrada, salida = p_salida, sin_salida = false, editado = true
  where id = p_id
  returning * into nuevo;
  insert into public.fichajes_cambios (local_id, fichaje_id, empleado_id, accion, antes, despues, motivo, autor)
  values (v_local, p_id, p_empleado, 'editar',
          jsonb_build_object('entrada', viejo.entrada, 'salida', viejo.salida, 'sin_salida', viejo.sin_salida),
          jsonb_build_object('entrada', nuevo.entrada, 'salida', nuevo.salida), trim(p_motivo), (select auth.uid()));
  return p_id;
end;
$$;

create function public.borrar_fichaje(p_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  viejo public.fichajes;
begin
  if (select auth.uid()) is null then raise exception 'Sin sesión'; end if;
  if p_motivo is null or char_length(trim(p_motivo)) < 2 then raise exception 'Indica el motivo del cambio'; end if;
  select * into viejo from public.fichajes where id = p_id for update;
  if not found or not public.es_mi_local(viejo.local_id) then raise exception 'Fichaje no encontrado'; end if;
  delete from public.fichajes where id = p_id;
  insert into public.fichajes_cambios (local_id, fichaje_id, empleado_id, accion, antes, despues, motivo, autor)
  values (viejo.local_id, p_id, viejo.empleado_id, 'borrar',
          jsonb_build_object('entrada', viejo.entrada, 'salida', viejo.salida, 'sin_salida', viejo.sin_salida),
          null, trim(p_motivo), (select auth.uid()));
end;
$$;

-- Fichajes, turnos previstos e historial de un periodo (fechas de Madrid, ambas incluidas).
create function public.cargar_fichajes(p_desde date, p_hasta date)
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
          'sin_salida', f.sin_salida, 'origen', f.origen, 'editado', f.editado) order by f.entrada)
      from public.fichajes f
      where f.local_id = v_local
        and (f.entrada at time zone 'Europe/Madrid')::date between p_desde and p_hasta), '[]'::jsonb),
    'turnos', coalesce((
      select jsonb_agg(jsonb_build_object('empleado_id', t.empleado_id, 'fecha', s.fecha_inicio + t.dia, 'franja', t.franja))
      from public.turnos t join public.semanas s on s.id = t.semana_id
      where s.local_id = v_local and s.fecha_inicio + t.dia between p_desde and p_hasta), '[]'::jsonb),
    -- Personas que ya no están en el equipo pero tienen horas en el periodo (hay que conservarlas).
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

-- ---------- 4. Franjas: guardar la lista completa ----------
-- p_franjas: [{"franja":"M","etiqueta":"Mañana","inicio":"09:00","fin":"17:00","horas":8,"cierre":false}, …]
-- El orden de la lista es el orden en pantalla. Las franjas nuevas empiezan con
-- todo el equipo disponible. Las que desaparecen se borran; si ya tienen turnos
-- en algún cuadrante, se archivan.
create function public.guardar_franjas(p_franjas jsonb)
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

  -- Franjas que no existían (ni archivadas): todo el equipo empieza disponible en ellas.
  select coalesce(array_agg(f ->> 'franja'), '{}') into nuevas
  from jsonb_array_elements(p_franjas) f
  where not exists (select 1 from public.franjas fr where fr.local_id = v_local and fr.franja = f ->> 'franja');

  insert into public.franjas (local_id, franja, etiqueta, inicio, fin, horas, cierre, orden, activa)
  select v_local, f ->> 'franja', trim(f ->> 'etiqueta'), (f ->> 'inicio')::time, (f ->> 'fin')::time,
         (f ->> 'horas')::numeric, coalesce((f ->> 'cierre')::boolean, false), (ord - 1)::smallint, true
  from jsonb_array_elements(p_franjas) with ordinality as x(f, ord)
  on conflict (local_id, franja) do update
    set etiqueta = excluded.etiqueta, inicio = excluded.inicio, fin = excluded.fin,
        horas = excluded.horas, cierre = excluded.cierre, orden = excluded.orden, activa = true;

  insert into public.disponibilidad (empleado_id, dia, franja)
  select e.id, d.dia, x.franja
  from public.empleados e
  cross join generate_series(0, 6) as d(dia)
  cross join unnest(nuevas) as x(franja)
  where e.local_id = v_local and e.activo
  on conflict do nothing;

  -- Las que ya no están: fuera de la disponibilidad y la demanda…
  delete from public.disponibilidad d
  using public.empleados e
  where e.id = d.empleado_id and e.local_id = v_local
    and d.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f);
  -- …archivadas si se usaron en algún cuadrante (para no romper el historial)…
  update public.franjas fr set activa = false
  where fr.local_id = v_local
    and fr.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f)
    and exists (select 1 from public.turnos t join public.semanas s on s.id = t.semana_id
                where s.local_id = v_local and t.franja = fr.franja);
  delete from public.demanda dm
  where dm.local_id = v_local
    and dm.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f);
  -- …y borradas si nunca se usaron.
  delete from public.franjas fr
  where fr.local_id = v_local and fr.activa
    and fr.franja not in (select f ->> 'franja' from jsonb_array_elements(p_franjas) f);
end;
$$;

-- ---------- 5. Crear local con plantilla completa ----------
drop function if exists public.crear_local(text, jsonb, jsonb);
create function public.crear_local(p_nombre text, p_puestos jsonb, p_demanda jsonb, p_franjas jsonb default null)
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
  insert into public.locales (owner_id, nombre) values ((select auth.uid()), p_nombre) returning id into v_id;

  insert into public.franjas (local_id, franja, etiqueta, inicio, fin, horas, cierre, orden)
  select v_id, f ->> 'franja', f ->> 'etiqueta', (f ->> 'inicio')::time, (f ->> 'fin')::time,
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

-- ---------- 6. Cargas rápidas con los campos nuevos ----------
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
        'fichaje_margen_minutos', fichaje_margen_minutos) from l),
    'puestos', coalesce((
      select jsonb_agg(jsonb_build_object('clave', p.clave, 'nombre', p.nombre, 'color', p.color) order by p.orden, p.nombre)
      from public.puestos p join l on p.local_id = l.id), '[]'::jsonb),
    'empleados', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', e.id, 'nombre', e.nombre, 'puesto', e.puesto, 'horas_contrato', e.horas_contrato,
          'telefono', e.telefono, 'token_acceso', e.token_acceso, 'activo', e.activo,
          'min_dias_libres', e.min_dias_libres, 'max_cierres_seguidos', e.max_cierres_seguidos,
          'prefiere_librar', to_jsonb(e.prefiere_librar),
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
          'franja', f.franja, 'etiqueta', f.etiqueta, 'inicio', f.inicio, 'fin', f.fin, 'horas', f.horas,
          'cierre', f.cierre, 'orden', f.orden, 'activa', f.activa) order by f.activa desc, f.orden, f.franja)
      from public.franjas f join l on f.local_id = l.id), '[]'::jsonb)
  ) end;
$$;

-- Igual que en v2, más los fichajes de la semana (si el local ficha).
create or replace function public.cargar_semana(p_lunes date)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_local public.locales;
  v_semana public.semanas;
begin
  if extract(isodow from p_lunes) <> 1 then raise exception 'La semana debe empezar en lunes'; end if;
  select * into v_local from public.locales order by created_at limit 1;
  if v_local.id is null then return null; end if;

  insert into public.semanas (local_id, fecha_inicio) values (v_local.id, p_lunes)
  on conflict (local_id, fecha_inicio) do nothing;
  select * into v_semana from public.semanas where local_id = v_local.id and fecha_inicio = p_lunes;

  return jsonb_build_object(
    'semana', jsonb_build_object(
      'id', v_semana.id, 'fecha_inicio', v_semana.fecha_inicio,
      'estado', v_semana.estado, 'publicado_at', v_semana.publicado_at),
    'turnos', coalesce((
      select jsonb_agg(jsonb_build_object('empleado_id', t.empleado_id, 'dia', t.dia, 'franja', t.franja))
      from public.turnos t where t.semana_id = v_semana.id), '[]'::jsonb),
    'solicitudes', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'tipo', s.tipo, 'dia', s.dia, 'mensaje', s.mensaje,
          'empleado_id', s.empleado_id, 'con_empleado_id', s.con_empleado_id) order by s.created_at)
      from public.solicitudes s where s.semana_id = v_semana.id and s.estado = 'pendiente'), '[]'::jsonb),
    'ausencias', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', a.id, 'empleado_id', a.empleado_id, 'desde', a.desde, 'hasta', a.hasta, 'motivo', a.motivo))
      from public.ausencias a join public.empleados e on e.id = a.empleado_id
      where e.local_id = v_local.id and a.desde <= p_lunes + 6 and a.hasta >= p_lunes), '[]'::jsonb),
    'fichajes', case when not v_local.fichaje_activo then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', f.id, 'empleado_id', f.empleado_id, 'entrada', f.entrada, 'salida', f.salida,
          'sin_salida', f.sin_salida, 'editado', f.editado) order by f.entrada)
      from public.fichajes f
      where f.local_id = v_local.id
        and (f.entrada at time zone 'Europe/Madrid')::date between p_lunes and p_lunes + 6), '[]'::jsonb) end,
    'semana_anterior_con_turnos', exists (
      select 1 from public.turnos t join public.semanas s on s.id = t.semana_id
      where s.local_id = v_local.id and s.fecha_inicio = p_lunes - 7),
    'alguna_publicada', exists (
      select 1 from public.semanas where local_id = v_local.id and publicado_at is not null)
  );
end;
$$;

-- ---------- 7. Funciones de v1/v2 que guardaban la franja en char(1) ----------
create or replace function public.aceptar_solicitud(p_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  s public.solicitudes;
  franja_a text;
  franja_b text;
begin
  select * into s from public.solicitudes where id = p_id and estado = 'pendiente' for update;
  if not found then raise exception 'Solicitud no encontrada o ya resuelta'; end if;

  if s.tipo = 'librar' then
    delete from public.turnos
    where semana_id = s.semana_id and empleado_id = s.empleado_id and dia = s.dia;
  else
    select franja into franja_a from public.turnos
      where semana_id = s.semana_id and empleado_id = s.empleado_id and dia = s.dia;
    select franja into franja_b from public.turnos
      where semana_id = s.semana_id and empleado_id = s.con_empleado_id and dia = s.dia;
    delete from public.turnos
      where semana_id = s.semana_id and dia = s.dia and empleado_id in (s.empleado_id, s.con_empleado_id);
    if franja_b is not null then
      insert into public.turnos values (s.semana_id, s.empleado_id, s.dia, franja_b);
    end if;
    if franja_a is not null then
      insert into public.turnos values (s.semana_id, s.con_empleado_id, s.dia, franja_a);
    end if;
  end if;

  update public.solicitudes set estado = 'aceptada' where id = p_id;
  update public.semanas set estado = 'cambios' where id = s.semana_id and estado = 'publicado';
end;
$$;

-- Copiar la semana anterior: solo personas en activo y franjas que siguen existiendo.
create or replace function public.copiar_semana_anterior(p_semana uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v public.semanas;
  v_prev uuid;
begin
  select * into v from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;
  select id into v_prev from public.semanas where local_id = v.local_id and fecha_inicio = v.fecha_inicio - 7;
  if v_prev is null or not exists (select 1 from public.turnos where semana_id = v_prev) then
    raise exception 'La semana anterior está vacía';
  end if;

  delete from public.turnos where semana_id = p_semana;
  insert into public.turnos (semana_id, empleado_id, dia, franja)
  select p_semana, t.empleado_id, t.dia, t.franja
  from public.turnos t
  join public.empleados e on e.id = t.empleado_id
  join public.franjas f on f.local_id = v.local_id and f.franja = t.franja
  where t.semana_id = v_prev and e.activo and f.activa;

  update public.semanas set estado = 'cambios' where id = p_semana and estado = 'publicado';

  return coalesce((
    select jsonb_agg(jsonb_build_object('empleado_id', empleado_id, 'dia', dia, 'franja', franja))
    from public.turnos where semana_id = p_semana), '[]'::jsonb);
end;
$$;

-- ---------- Permisos ----------
revoke execute on function public.fichar(text) from public, anon, authenticated;
revoke execute on function public.guardar_fichaje(uuid, uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.borrar_fichaje(uuid, text) from public, anon;
revoke execute on function public.cargar_fichajes(date, date) from public, anon;
revoke execute on function public.guardar_franjas(jsonb) from public, anon;
revoke execute on function public.crear_local(text, jsonb, jsonb, jsonb) from public, anon;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fichar(text) to service_role;
  end if;
end $$;
grant execute on function public.guardar_fichaje(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.borrar_fichaje(uuid, text) to authenticated;
grant execute on function public.cargar_fichajes(date, date) to authenticated;
grant execute on function public.guardar_franjas(jsonb) to authenticated;
grant execute on function public.crear_local(text, jsonb, jsonb, jsonb) to authenticated;
