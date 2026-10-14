-- ============================================================
-- Rotafy · v2
--   1. Reglas laborales: descanso mínimo entre jornadas y días libres
--   2. Puestos personalizables (cada local crea los suyos)
--   3. Ausencias: vacaciones, bajas y permisos
--   4. Cargas rápidas: cada pantalla pide todo en UNA consulta
--   5. Crear local y copiar semana como operaciones atómicas
-- Se ejecuta DESPUÉS de 20261014000000_init.sql.
-- ============================================================

-- ---------- 1. Reglas laborales ----------
alter table public.locales
  add column descanso_minimo_horas smallint not null default 12
    check (descanso_minimo_horas between 0 and 24),
  add column min_dias_libres smallint not null default 2
    check (min_dias_libres between 0 and 6);

-- La regla fija "noche → mañana" queda sustituida por el descanso mínimo,
-- que se calcula con los horarios reales de las franjas.
alter table public.locales drop column prohibir_noche_manana;

-- ---------- 2. Puestos ----------
create table public.puestos (
  local_id  uuid not null references public.locales (id) on delete cascade,
  clave     text not null check (clave ~ '^[a-z0-9-]{1,40}$'),
  nombre    text not null check (char_length(nombre) between 1 and 40),
  color     smallint not null default 0 check (color between 0 and 9),
  orden     smallint not null default 0,
  primary key (local_id, clave)
);

alter table public.puestos enable row level security;
create policy "puestos de mis locales" on public.puestos
  for all to authenticated
  using (public.es_mi_local(local_id)) with check (public.es_mi_local(local_id));

-- Los locales existentes conservan los puestos que ya usaban.
insert into public.puestos (local_id, clave, nombre, color, orden)
select u.local_id, u.puesto, initcap(replace(u.puesto, '-', ' ')),
       case u.puesto when 'sala' then 0 when 'cocina' then 1 when 'barra' then 2 else 7 end,
       case u.puesto when 'sala' then 0 when 'cocina' then 1 when 'barra' then 2 else 9 end
from (
  select local_id, puesto from public.empleados
  union
  select local_id, puesto from public.demanda
) u
on conflict do nothing;

-- Integridad: un empleado o una necesidad solo pueden usar puestos que existen.
-- No se puede borrar un puesto con empleados; sí uno que solo está en la demanda.
alter table public.empleados
  add constraint empleados_puesto_fk foreign key (local_id, puesto)
  references public.puestos (local_id, clave) on update cascade on delete restrict;
alter table public.demanda
  add constraint demanda_puesto_fk foreign key (local_id, puesto)
  references public.puestos (local_id, clave) on update cascade on delete cascade;

-- ---------- 3. Ausencias ----------
create table public.ausencias (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references public.empleados (id) on delete cascade,
  desde        date not null,
  hasta        date not null,
  motivo       text not null check (motivo in ('vacaciones', 'baja', 'permiso', 'otro')),
  nota         text check (char_length(nota) <= 200),
  created_at   timestamptz not null default now(),
  check (hasta >= desde),
  check (hasta - desde <= 366)
);
create index on public.ausencias (empleado_id, desde);

alter table public.ausencias enable row level security;
create policy "ausencias de mis empleados" on public.ausencias
  for all to authenticated
  using (exists (select 1 from public.empleados e where e.id = empleado_id and public.es_mi_local(e.local_id)))
  with check (exists (select 1 from public.empleados e where e.id = empleado_id and public.es_mi_local(e.local_id)));

-- ---------- 4. Cargas rápidas ----------
-- Todo lo que necesita la app sobre el local, en una sola ida y vuelta.
-- SECURITY INVOKER: las políticas RLS siguen filtrando por el encargado.
create function public.cargar_local()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with l as (
    select * from public.locales order by created_at limit 1
  )
  select case when not exists (select 1 from l) then null else jsonb_build_object(
    'local', (select jsonb_build_object(
        'id', id, 'nombre', nombre, 'max_noches_seguidas', max_noches_seguidas,
        'descanso_minimo_horas', descanso_minimo_horas, 'min_dias_libres', min_dias_libres) from l),
    'puestos', coalesce((
      select jsonb_agg(jsonb_build_object('clave', p.clave, 'nombre', p.nombre, 'color', p.color) order by p.orden, p.nombre)
      from public.puestos p join l on p.local_id = l.id), '[]'::jsonb),
    'empleados', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', e.id, 'nombre', e.nombre, 'puesto', e.puesto, 'horas_contrato', e.horas_contrato,
          'telefono', e.telefono, 'token_acceso', e.token_acceso, 'activo', e.activo,
          'disponibilidad', coalesce((
            select jsonb_agg(jsonb_build_object('empleado_id', d.empleado_id, 'dia', d.dia, 'franja', d.franja))
            from public.disponibilidad d where d.empleado_id = e.id), '[]'::jsonb)
        ) order by e.created_at)
      from public.empleados e join l on e.local_id = l.id where e.activo), '[]'::jsonb),
    'demanda', coalesce((
      select jsonb_agg(jsonb_build_object('dia', dm.dia, 'franja', dm.franja, 'puesto', dm.puesto, 'cantidad', dm.cantidad))
      from public.demanda dm join l on dm.local_id = l.id), '[]'::jsonb),
    'franjas', coalesce((
      select jsonb_agg(jsonb_build_object('franja', f.franja, 'etiqueta', f.etiqueta, 'inicio', f.inicio, 'fin', f.fin, 'horas', f.horas))
      from public.franjas f join l on f.local_id = l.id), '[]'::jsonb)
  ) end;
$$;

-- Todo lo de una semana (la crea si no existe), en una sola ida y vuelta.
create function public.cargar_semana(p_lunes date)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_local uuid;
  v_semana public.semanas;
begin
  if extract(isodow from p_lunes) <> 1 then raise exception 'La semana debe empezar en lunes'; end if;
  select id into v_local from public.locales order by created_at limit 1;
  if v_local is null then return null; end if;

  insert into public.semanas (local_id, fecha_inicio) values (v_local, p_lunes)
  on conflict (local_id, fecha_inicio) do nothing;
  select * into v_semana from public.semanas where local_id = v_local and fecha_inicio = p_lunes;

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
      where e.local_id = v_local and a.desde <= p_lunes + 6 and a.hasta >= p_lunes), '[]'::jsonb),
    'semana_anterior_con_turnos', exists (
      select 1 from public.turnos t join public.semanas s on s.id = t.semana_id
      where s.local_id = v_local and s.fecha_inicio = p_lunes - 7),
    'alguna_publicada', exists (
      select 1 from public.semanas where local_id = v_local and publicado_at is not null)
  );
end;
$$;

-- ---------- 5. Operaciones atómicas ----------
-- Crea el local con sus puestos y su plantilla de necesidades (todo o nada).
-- p_puestos: [{"clave":"sala","nombre":"Sala","color":0}, ...]
-- p_demanda: [{"dia":0,"franja":"M","puesto":"sala","cantidad":1}, ...]
create function public.crear_local(p_nombre text, p_puestos jsonb, p_demanda jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sin sesión'; end if;
  insert into public.locales (owner_id, nombre) values ((select auth.uid()), p_nombre) returning id into v_id;

  insert into public.puestos (local_id, clave, nombre, color, orden)
  select v_id, p ->> 'clave', p ->> 'nombre', (p ->> 'color')::smallint, (ord - 1)::smallint
  from jsonb_array_elements(coalesce(p_puestos, '[]'::jsonb)) with ordinality as x(p, ord);

  insert into public.demanda (local_id, dia, franja, puesto, cantidad)
  select v_id, (d ->> 'dia')::smallint, d ->> 'franja', d ->> 'puesto', (d ->> 'cantidad')::smallint
  from jsonb_array_elements(coalesce(p_demanda, '[]'::jsonb)) as d;

  return v_id;
end;
$$;

-- Copia los turnos de la semana anterior (solo empleados activos) y los devuelve.
create function public.copiar_semana_anterior(p_semana uuid)
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
  from public.turnos t join public.empleados e on e.id = t.empleado_id
  where t.semana_id = v_prev and e.activo;

  update public.semanas set estado = 'cambios' where id = p_semana and estado = 'publicado';

  return coalesce((
    select jsonb_agg(jsonb_build_object('empleado_id', empleado_id, 'dia', dia, 'franja', franja))
    from public.turnos where semana_id = p_semana), '[]'::jsonb);
end;
$$;

revoke execute on function public.cargar_local() from public, anon;
revoke execute on function public.cargar_semana(date) from public, anon;
revoke execute on function public.crear_local(text, jsonb, jsonb) from public, anon;
revoke execute on function public.copiar_semana_anterior(uuid) from public, anon;
grant execute on function public.cargar_local() to authenticated;
grant execute on function public.cargar_semana(date) to authenticated;
grant execute on function public.crear_local(text, jsonb, jsonb) to authenticated;
grant execute on function public.copiar_semana_anterior(uuid) to authenticated;
