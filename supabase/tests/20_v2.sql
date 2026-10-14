-- Pruebas de la migración v2: puestos, ausencias, cargas rápidas y operaciones atómicas.
-- Se ejecuta después de 10_rls_y_funciones.sql (reutiliza sus usuarios).
\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

-- ---------- crear_local: todo o nada ----------
select public.crear_local('Tienda B',
  '[{"clave":"caja","nombre":"Caja","color":3},{"clave":"reposicion","nombre":"Reposición","color":5}]',
  '[{"dia":0,"franja":"M","puesto":"caja","cantidad":2},{"dia":0,"franja":"T","puesto":"reposicion","cantidad":1}]');

do $$
declare v jsonb;
begin
  v := public.cargar_local();
  if v -> 'local' ->> 'nombre' <> 'Tienda B' then raise exception 'cargar_local no devuelve el local: %', v; end if;
  if jsonb_array_length(v -> 'puestos') <> 2 then raise exception 'faltan puestos'; end if;
  if v -> 'puestos' -> 0 ->> 'clave' <> 'caja' then raise exception 'los puestos no respetan el orden'; end if;
  if jsonb_array_length(v -> 'demanda') <> 2 then raise exception 'falta la demanda'; end if;
  if jsonb_array_length(v -> 'franjas') <> 3 then raise exception 'faltan las franjas por defecto'; end if;
  if (v -> 'local' ->> 'descanso_minimo_horas')::int <> 12 then raise exception 'descanso por defecto incorrecto'; end if;
end $$;

-- Una demanda con un puesto inexistente hace fallar TODO (no queda un local a medias)
do $$
declare n int;
begin
  begin
    perform public.crear_local('Roto', '[{"clave":"caja","nombre":"Caja","color":0}]',
      '[{"dia":0,"franja":"M","puesto":"no-existe","cantidad":1}]');
    raise exception 'debería haber fallado';
  exception when foreign_key_violation then null;
  end;
  select count(*) into n from public.locales where nombre = 'Roto';
  if n <> 0 then raise exception 'quedó un local a medias'; end if;
end $$;

-- ---------- Integridad de puestos ----------
insert into public.empleados (id, local_id, nombre, puesto, horas_contrato)
select 'e0000000-0000-0000-0000-0000000000b1', id, 'Bea', 'caja', 30 from public.locales where nombre = 'Tienda B';

do $$ begin
  insert into public.empleados (local_id, nombre, puesto, horas_contrato)
  select id, 'X', 'puesto-fantasma', 10 from public.locales where nombre = 'Tienda B';
  raise exception 'debería exigir un puesto existente';
exception when foreign_key_violation then null;
end $$;

do $$ begin
  delete from public.puestos where clave = 'caja';
  raise exception 'no debería poder borrar un puesto con empleados';
exception when foreign_key_violation then null;
end $$;

-- Borrar un puesto sin empleados borra también su demanda
delete from public.puestos where clave = 'reposicion';
do $$ begin
  if exists (select 1 from public.demanda where puesto = 'reposicion') then raise exception 'la demanda huérfana no se borró'; end if;
end $$;

-- Renombrar la clave de un puesto se propaga a empleados y demanda
update public.puestos set clave = 'cajas' where clave = 'caja';
do $$ begin
  if (select puesto from public.empleados where id = 'e0000000-0000-0000-0000-0000000000b1') <> 'cajas'
  then raise exception 'el cambio de clave no se propagó'; end if;
end $$;

-- ---------- Ausencias y cargar_semana ----------
insert into public.ausencias (empleado_id, desde, hasta, motivo)
values ('e0000000-0000-0000-0000-0000000000b1', '2026-10-14', '2026-10-20', 'vacaciones');

do $$
declare v jsonb;
begin
  v := public.cargar_semana('2026-10-12');
  if v -> 'semana' ->> 'estado' <> 'borrador' then raise exception 'la semana no se creó: %', v; end if;
  if jsonb_array_length(v -> 'ausencias') <> 1 then raise exception 'falta la ausencia que solapa la semana'; end if;
  if (v ->> 'semana_anterior_con_turnos')::boolean then raise exception 'no debería haber semana anterior'; end if;
  -- llamarla otra vez no duplica la semana
  perform public.cargar_semana('2026-10-12');
  if (select count(*) from public.semanas where fecha_inicio = '2026-10-12') <> 1 then raise exception 'semana duplicada'; end if;
  -- una semana que no solapa no trae la ausencia
  v := public.cargar_semana('2026-10-26');
  if jsonb_array_length(v -> 'ausencias') <> 0 then raise exception 'ausencia fuera de rango'; end if;
end $$;

do $$ begin
  perform public.cargar_semana('2026-10-14');
  raise exception 'debería exigir lunes';
exception when raise_exception then
  if sqlerrm <> 'La semana debe empezar en lunes' then raise; end if;
end $$;

-- ---------- copiar_semana_anterior ----------
do $$
declare w1 uuid; w2 uuid; v jsonb;
begin
  w1 := (public.cargar_semana('2026-10-12') -> 'semana' ->> 'id')::uuid;
  perform public.guardar_cuadrante(w1, '[{"empleado_id":"e0000000-0000-0000-0000-0000000000b1","dia":0,"franja":"M"},{"empleado_id":"e0000000-0000-0000-0000-0000000000b1","dia":1,"franja":"T"}]');
  w2 := (public.cargar_semana('2026-10-19') -> 'semana' ->> 'id')::uuid;
  v := public.copiar_semana_anterior(w2);
  if jsonb_array_length(v) <> 2 then raise exception 'no copió los 2 turnos: %', v; end if;
  if not (public.cargar_semana('2026-10-26') ->> 'semana_anterior_con_turnos')::boolean then
    raise exception 'debería detectar que la semana anterior tiene turnos';
  end if;
end $$;

-- ---------- Aislamiento: el encargado A no ve nada de B ----------
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare v jsonb;
begin
  v := public.cargar_local();
  if v -> 'local' ->> 'nombre' <> 'Bar A' then raise exception 'A ve un local ajeno: %', v; end if;
  if exists (select 1 from public.ausencias) then raise exception 'A ve ausencias ajenas'; end if;
  if exists (select 1 from public.puestos where clave = 'cajas') then raise exception 'A ve puestos ajenos'; end if;
end $$;

do $$ begin
  insert into public.ausencias (empleado_id, desde, hasta, motivo)
  values ('e0000000-0000-0000-0000-0000000000b1', '2026-11-01', '2026-11-02', 'baja');
  raise exception 'A no debería poder crear ausencias a empleados de B';
exception when insufficient_privilege then null;
end $$;

-- Un usuario sin local recibe null, no un error
reset role;
insert into auth.users values ('33333333-3333-3333-3333-333333333333');
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if public.cargar_local() is not null then raise exception 'sin local debería devolver null'; end if;
  if public.cargar_semana('2026-10-12') is not null then raise exception 'sin local debería devolver null'; end if;
end $$;
reset role;

select 'TODAS LAS PRUEBAS V2 PASAN' as resultado;
