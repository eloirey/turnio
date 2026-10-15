-- Rotafy v6: desde qué día se ficha.
-- Al activar el fichaje a mitad de semana, los días anteriores no deben salir
-- como «No fichó». Se guarda el día en que se activó y antes de esa fecha no se
-- revisa nada (salvo que haya fichajes).
-- Se puede ejecutar sobre una base con datos.

alter table public.locales add column if not exists fichaje_desde date;

-- Locales que ya fichan: desde su primer fichaje (o desde hoy si aún no hay).
update public.locales l
set fichaje_desde = coalesce(
  (select (min(f.entrada) at time zone 'Europe/Madrid')::date from public.fichajes f where f.local_id = l.id),
  (now() at time zone 'Europe/Madrid')::date)
where l.fichaje_activo and l.fichaje_desde is null;

-- Al activar el fichaje se apunta el día (hora de Madrid).
create or replace function public.marcar_fichaje_desde()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.fichaje_activo and not old.fichaje_activo then
    new.fichaje_desde := (now() at time zone 'Europe/Madrid')::date;
  end if;
  return new;
end;
$$;
revoke execute on function public.marcar_fichaje_desde() from public, anon, authenticated;

drop trigger if exists locales_fichaje_desde on public.locales;
create trigger locales_fichaje_desde before update of fichaje_activo on public.locales
  for each row execute function public.marcar_fichaje_desde();

-- cargar_local devuelve también fichaje_desde.
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
        'fichaje_desde', fichaje_desde,
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

-- Índices para las consultas más repetidas.
-- Avisos pendientes de mandar al móvil (se mira después de cada acción).
create index if not exists avisos_push_pendientes on public.avisos (creado_en) where push_en is null;
-- «Mi registro» del empleado: motivos de las correcciones.
create index if not exists fichajes_cambios_empleado on public.fichajes_cambios (empleado_id, created_at);
-- Solicitudes de un empleado (su página).
create index if not exists solicitudes_empleado on public.solicitudes (empleado_id);
