-- Pruebas de la migración v5: control de fichaje, teletrabajo, turnos partidos,
-- avisos push y varios encargados. Usa el local «Autobuses C» de 30_v3.sql.
\set ON_ERROR_STOP on

reset role;
insert into auth.users (id) values ('66666666-6666-6666-6666-666666666666'), ('77777777-7777-7777-7777-777777777777')
on conflict do nothing;
update auth.users set email = 'carla@bar.es' where id = '66666666-6666-6666-6666-666666666666';
update public.empleados set activo = true where id = 'e0000000-0000-0000-0000-0000000000c1';
update public.locales set fichaje_activo = true where nombre = 'Autobuses C';
delete from public.fichajes where empleado_id in ('e0000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c2');

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);

-- ---------- Control de fichaje ----------
update public.locales set fichaje_control = 'avisar', fichaje_lat = 41.1189, fichaje_lng = 1.2445, fichaje_radio_m = 150, fichaje_ips = '{83.45.12.9}'
where nombre = 'Autobuses C';
do $$ begin
  update public.locales set fichaje_control = 'siempre' where nombre = 'Autobuses C';
  raise exception 'debería rechazar un modo desconocido';
exception when check_violation then null;
end $$;
do $$ begin
  update public.locales set fichaje_lat = 41.1, fichaje_lng = null where nombre = 'Autobuses C';
  raise exception 'latitud sin longitud';
exception when check_violation then null;
end $$;
update public.empleados set teletrabajo_dias = '{1,3}' where id = 'e0000000-0000-0000-0000-0000000000c2';
do $$ begin
  update public.empleados set teletrabajo_dias = '{7}' where id = 'e0000000-0000-0000-0000-0000000000c2';
  raise exception 'debería rechazar el día 7';
exception when check_violation then null;
end $$;
do $$ declare v jsonb; begin
  v := public.cargar_local();
  if v -> 'local' ->> 'fichaje_control' <> 'avisar' or (v -> 'local' ->> 'fichaje_radio_m')::int <> 150 then raise exception 'cargar_local sin control: %', v -> 'local'; end if;
  if not (v -> 'local' ->> 'es_dueno')::boolean then raise exception 'el dueño debería ser dueño'; end if;
  if not exists (select 1 from jsonb_array_elements(v -> 'empleados') e where e ->> 'nombre' = 'Berta' and e -> 'teletrabajo_dias' = '[1, 3]'::jsonb) then
    raise exception 'falta el teletrabajo de Berta';
  end if;
end $$;

-- Fichar guarda solo el resultado de la comprobación
reset role;
delete from public.avisos;
set role service_role;
select public.fichar(token_acceso, 'fuera', 1250) from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1';
reset role;
update public.fichajes set entrada = now() - interval '2 hours' where empleado_id = 'e0000000-0000-0000-0000-0000000000c1';
set role service_role;
select public.fichar(token_acceso, 'local', 30) from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1';
select public.fichar(token_acceso, 'teletrabajo', null) from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c2';
reset role;
do $$ begin
  if not exists (select 1 from public.fichajes where empleado_id = 'e0000000-0000-0000-0000-0000000000c1'
                 and ubicacion_entrada = 'fuera' and distancia_entrada_m = 1250 and ubicacion_salida = 'local' and salida is not null) then
    raise exception 'no se guardó dónde fichó: %', (select jsonb_agg(f) from public.fichajes f);
  end if;
  if not exists (select 1 from public.fichajes where empleado_id = 'e0000000-0000-0000-0000-0000000000c2' and ubicacion_entrada = 'teletrabajo') then
    raise exception 'falta el teletrabajo';
  end if;
  if not exists (select 1 from public.avisos where empleado_id is null and titulo = 'Andrés fichó la entrada fuera del local' and cuerpo like '%a unos 1,3 km.') then
    raise exception 'aviso de fichaje fuera: %', (select array_agg(titulo || ' | ' || cuerpo) from public.avisos);
  end if;
  if (select count(*) from public.avisos where titulo like '%fuera del local') <> 1 then raise exception 'solo un aviso de fuera'; end if;
end $$;
do $$ begin
  perform public.fichar('x', 'en casa', null);
  raise exception 'debería rechazar una ubicación desconocida';
exception when raise_exception then
  if sqlerrm <> 'Ubicación no válida' then raise; end if;
end $$;

-- ---------- Turnos partidos ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select public.guardar_franjas('[
  {"franja":"L12","etiqueta":"Línea 12","inicio":"06:00","fin":"14:00","horas":8},
  {"franja":"PAR","etiqueta":"Partido","inicio":"12:00","fin":"16:00","inicio2":"20:00","fin2":"00:00","horas":8}]');
do $$ declare v jsonb; begin
  v := public.cargar_local();
  if not exists (select 1 from jsonb_array_elements(v -> 'franjas') f
                 where f ->> 'franja' = 'PAR' and f ->> 'inicio2' = '20:00:00' and f ->> 'fin2' = '00:00:00') then
    raise exception 'falta el segundo tramo: %', v -> 'franjas';
  end if;
end $$;
do $$ begin
  insert into public.franjas (local_id, franja, etiqueta, inicio, fin, inicio2, horas)
  select id, 'X', 'Mal', '09:00', '13:00', '17:00', 4 from public.locales where nombre = 'Autobuses C';
  raise exception 'un partido necesita inicio y fin del segundo tramo';
exception when check_violation then null;
end $$;

-- ---------- Avisos al móvil ----------
reset role;
insert into public.push_suscripciones (local_id, empleado_id, endpoint, p256dh, auth)
select local_id, id, 'https://push.example/1', 'clave', 'secreto' from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  if exists (select 1 from public.push_suscripciones) then raise exception 'un encargado no debería ver suscripciones'; end if;
end $$;
do $$ begin
  perform public.tomar_avisos_push(10);
  raise exception 'solo el servidor puede tomar avisos';
exception when insufficient_privilege then null;
end $$;
set role service_role;
do $$ declare n int; m int; begin
  select count(*) into n from public.tomar_avisos_push(100);
  select count(*) into m from public.tomar_avisos_push(100);
  if n < 1 or m <> 0 then raise exception 'cada aviso se manda una vez: % y %', n, m; end if;
end $$;

-- ---------- Varios encargados ----------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
insert into public.invitaciones (local_id, creada_por)
select id, '44444444-4444-4444-4444-444444444444' from public.locales where nombre = 'Autobuses C';
-- Otro encargado no puede invitar a un local ajeno
reset role;
select id as bus from public.locales where nombre = 'Autobuses C' \gset
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\set ON_ERROR_STOP off
insert into public.invitaciones (local_id, creada_por) values (:'bus', '66666666-6666-6666-6666-666666666666');
\set ON_ERROR_STOP on
reset role;
do $$ begin
  if exists (select 1 from public.invitaciones where creada_por = '66666666-6666-6666-6666-666666666666') then
    raise exception 'no debería poder invitar a un local ajeno';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
do $$ begin
  if exists (select 1 from public.locales where nombre = 'Autobuses C') then raise exception 'aún no debería ver el local'; end if;
end $$;

-- Acepta la invitación
reset role;
select token as tok from public.invitaciones order by creada_en desc limit 1 \gset
select set_config('test.tok', :'tok', false);
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select public.aceptar_invitacion(:'tok');
do $$ declare v jsonb; begin
  v := public.cargar_local();
  if v -> 'local' ->> 'nombre' <> 'Autobuses C' then raise exception 'el encargado invitado no ve el local'; end if;
  if (v -> 'local' ->> 'es_dueno')::boolean then raise exception 'el invitado no es el dueño'; end if;
  if jsonb_array_length(v -> 'empleados') < 2 then raise exception 'el invitado no ve al equipo'; end if;
end $$;
update public.locales set nombre = 'Autobuses Costa' where nombre = 'Autobuses C';
do $$ begin
  if not exists (select 1 from public.locales where nombre = 'Autobuses Costa') then raise exception 'el invitado debería poder editar'; end if;
end $$;
delete from public.locales where nombre = 'Autobuses Costa';
do $$ begin
  if not exists (select 1 from public.locales where nombre = 'Autobuses Costa') then raise exception 'el invitado NO puede borrar el negocio'; end if;
end $$;
do $$ begin
  update public.locales set owner_id = '66666666-6666-6666-6666-666666666666' where nombre = 'Autobuses Costa';
  raise exception 'un encargado invitado no puede quedarse el negocio';
exception when raise_exception then
  if sqlerrm <> 'No se puede cambiar el dueño del negocio' then raise; end if;
end $$;
do $$ begin
  perform public.crear_local('Otro', '[]', '[]');
  raise exception 'un encargado invitado no crea otro negocio';
exception when raise_exception then
  if sqlerrm <> 'Ya gestionas un negocio' then raise; end if;
end $$;
-- Los avisos del encargado son de todos los encargados del local
select public.leer_avisos();
reset role;
do $$ begin
  if exists (select 1 from public.avisos a join public.locales l on l.id = a.local_id
             where l.nombre = 'Autobuses Costa' and a.empleado_id is null and a.leido_en is null) then
    raise exception 'el invitado debería poder marcar los avisos';
  end if;
end $$;

-- La invitación no se puede reutilizar
set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
do $$ begin
  perform public.aceptar_invitacion(current_setting('test.tok'));
  raise exception 'una invitación usada no vale otra vez';
exception when raise_exception then
  if sqlerrm <> 'Esta invitación ya se ha usado' then raise; end if;
end $$;

-- El dueño ve a sus encargados y puede quitar a uno
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  if not exists (select 1 from public.local_miembros where email = 'carla@bar.es') then raise exception 'el dueño no ve a su encargada'; end if;
end $$;
delete from public.local_miembros where user_id = '66666666-6666-6666-6666-666666666666';
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
do $$ begin
  if exists (select 1 from public.locales where nombre = 'Autobuses Costa') then raise exception 'al quitarla deja de ver el local'; end if;
end $$;

reset role;
update public.locales set nombre = 'Autobuses C' where nombre = 'Autobuses Costa';
select 'TODAS LAS PRUEBAS DE v5 PASAN' as resultado;
