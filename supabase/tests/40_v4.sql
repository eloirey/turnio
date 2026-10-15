-- Pruebas de la migración v4: avisos (campanita).
-- Usa el local «Autobuses C» y las personas que crea 30_v3.sql.
\set ON_ERROR_STOP on

reset role;
delete from public.avisos;
-- 30_v3 archiva a Andrés; aquí vuelve al equipo.
update public.empleados set activo = true where id = 'e0000000-0000-0000-0000-0000000000c1';

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);

-- ---------- Publicar el horario ----------
insert into public.semanas (id, local_id, fecha_inicio)
select 'a0000000-0000-0000-0000-0000000000a1', id, '2026-11-02' from public.locales where nombre = 'Autobuses C';
insert into public.turnos values ('a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000c1', 0, 'L12');
select public.publicar_semana('a0000000-0000-0000-0000-0000000000a1');

reset role;
do $$ begin
  if (select count(*) from public.avisos where tipo = 'horario') <> 1 then raise exception 'debería avisar solo a quien tiene turnos'; end if;
  if not exists (select 1 from public.avisos where empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and titulo = 'Ya está tu horario del 2 al 8 de noviembre') then
    raise exception 'título del horario: %', (select array_agg(titulo) from public.avisos);
  end if;
end $$;

-- Volver a publicar: solo avisa a quien le cambia algo
set role authenticated;
insert into public.turnos values ('a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000c2', 1, 'NOC');
select public.publicar_semana('a0000000-0000-0000-0000-0000000000a1');
reset role;
do $$ begin
  if (select count(*) from public.avisos where tipo = 'horario') <> 2 then raise exception 'al republicar, solo a Berta: %', (select array_agg(titulo) from public.avisos); end if;
  if not exists (select 1 from public.avisos where empleado_id = 'e0000000-0000-0000-0000-0000000000c2' and titulo like 'Ha cambiado tu horario%') then
    raise exception 'Berta debería tener «Ha cambiado tu horario»';
  end if;
end $$;

-- ---------- Solicitudes ----------
set role service_role;
insert into public.solicitudes (id, semana_id, empleado_id, tipo, dia, mensaje)
values ('a0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000c1', 'librar', 0, 'Médico');
insert into public.solicitudes (id, semana_id, empleado_id, tipo, dia, con_empleado_id)
values ('a0000000-0000-0000-0000-0000000000b2', 'a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000c2', 'intercambio', 1, 'e0000000-0000-0000-0000-0000000000c1');

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  if (select count(*) from public.avisos) <> 2 then raise exception 'el encargado solo ve sus 2 avisos, no los del equipo: %', (select array_agg(titulo) from public.avisos); end if;
  if not exists (select 1 from public.avisos where titulo = 'Andrés pide librar el lunes 2' and cuerpo = 'Médico' and enlace = '/app/cuadrante?semana=2026-11-02') then
    raise exception 'aviso de solicitud: %', (select array_agg(titulo || ' | ' || coalesce(cuerpo, '')) from public.avisos);
  end if;
  if not exists (select 1 from public.avisos where titulo = 'Berta quiere cambiar el turno del martes 3 con Andrés') then
    raise exception 'aviso de intercambio';
  end if;
end $$;

-- Otro encargado no ve nada
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin
  if exists (select 1 from public.avisos) then raise exception 'otro encargado ve avisos ajenos'; end if;
end $$;
select public.leer_avisos();

-- Nadie puede crear avisos a mano
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  insert into public.avisos (local_id, tipo, titulo) select id, 'anuncio', 'falso' from public.locales where nombre = 'Autobuses C';
  raise exception 'debería impedir crear avisos';
exception when insufficient_privilege then null;
end $$;

-- Rechazar una y aceptar la otra
update public.solicitudes set estado = 'rechazada' where id = 'a0000000-0000-0000-0000-0000000000b1';
select public.aceptar_solicitud('a0000000-0000-0000-0000-0000000000b2');
reset role;
do $$ begin
  if not exists (select 1 from public.avisos where empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and titulo = 'No aceptado: librar el lunes 2') then
    raise exception 'aviso de rechazo: %', (select array_agg(titulo) from public.avisos where empleado_id is not null);
  end if;
  if not exists (select 1 from public.avisos where empleado_id = 'e0000000-0000-0000-0000-0000000000c2' and titulo = 'Aceptado: cambiar el turno del martes 3 con Andrés') then
    raise exception 'aviso de aceptación';
  end if;
  if not exists (select 1 from public.avisos where empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and titulo = 'Cambias el turno del martes 3 con Berta') then
    raise exception 'el compañero del intercambio también se entera';
  end if;
end $$;

-- ---------- Fichajes ----------
set role service_role;
insert into public.fichajes (local_id, empleado_id, entrada, sin_salida)
select local_id, id, '2026-10-05 06:00+02', true from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1';
reset role;
do $$ begin
  if not exists (select 1 from public.avisos where empleado_id is null and titulo = 'Andrés no fichó la salida el lunes 5' and enlace = '/app/fichajes?semana=2026-10-05') then
    raise exception 'aviso de olvido al encargado: %', (select array_agg(titulo) from public.avisos where empleado_id is null);
  end if;
  if not exists (select 1 from public.avisos where empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and titulo = 'No fichaste la salida el lunes 5') then
    raise exception 'aviso de olvido a la persona';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select public.guardar_fichaje(f.id, f.empleado_id, '2026-10-05 06:00+02', '2026-10-05 14:00+02', 'Olvidó fichar al acabar')
from public.fichajes f where f.empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and f.sin_salida;
reset role;
do $$ begin
  if not exists (select 1 from public.avisos where empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and titulo = 'Tu encargado ha corregido tu fichaje del lunes 5' and cuerpo = 'Motivo: Olvidó fichar al acabar') then
    raise exception 'aviso de corrección: %', (select array_agg(titulo) from public.avisos where empleado_id is not null);
  end if;
end $$;

-- ---------- Leer ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select public.leer_avisos();
reset role;
do $$ begin
  if exists (select 1 from public.avisos a join public.locales l on l.id = a.local_id
             where l.nombre = 'Autobuses C' and a.empleado_id is null and a.leido_en is null) then
    raise exception 'leer_avisos debería marcarlos todos';
  end if;
  if not exists (select 1 from public.avisos where empleado_id is not null and leido_en is null) then
    raise exception 'leer_avisos no debe tocar los del equipo';
  end if;
end $$;

-- ---------- Anuncios ----------
do $$ declare n int; begin
  n := public.publicar_anuncio('Novedad: exporta a Excel', 'En Cuadrante → Más.', 'todos');
  if n <> (select count(*) from public.locales) + (select count(*) from public.empleados where activo) then
    raise exception 'anuncio: % avisos', n;
  end if;
end $$;
set role authenticated;
do $$ begin
  perform public.publicar_anuncio('Hackeo', null, 'todos');
  raise exception 'un encargado no debería poder mandar anuncios';
exception when insufficient_privilege then null;
end $$;

reset role;
select 'TODAS LAS PRUEBAS DE v4 PASAN' as resultado;
