-- Pruebas de la migración v3: franjas libres, reglas por persona y fichajes.
-- Se ejecuta después de 10 y 20 (pueden ir antes o después de la migración v3).
\set ON_ERROR_STOP on

reset role;
insert into auth.users values ('44444444-4444-4444-4444-444444444444'), ('55555555-5555-5555-5555-555555555555')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);

-- ---------- Local con franjas propias (conductores de autobús) ----------
select public.crear_local('Autobuses C',
  '[{"clave":"conductores","nombre":"Conductores","color":4}]',
  '[{"dia":0,"franja":"L12","puesto":"conductores","cantidad":2}]',
  '[{"franja":"L12","etiqueta":"Línea 12","inicio":"06:00","fin":"14:00","horas":8,"cierre":false},
    {"franja":"L7","etiqueta":"Línea 7","inicio":"14:00","fin":"22:00","horas":8,"cierre":false},
    {"franja":"NOC","etiqueta":"Nocturno","inicio":"22:00","fin":"06:00","horas":8,"cierre":true}]');

do $$
declare v jsonb;
begin
  v := public.cargar_local();
  if v -> 'local' ->> 'nombre' <> 'Autobuses C' then raise exception 'local equivocado: %', v -> 'local'; end if;
  if jsonb_array_length(v -> 'franjas') <> 3 then raise exception 'faltan franjas: %', v -> 'franjas'; end if;
  if v -> 'franjas' -> 0 ->> 'etiqueta' <> 'Línea 12' or v -> 'franjas' -> 2 ->> 'franja' <> 'NOC' then
    raise exception 'las franjas no respetan el orden: %', v -> 'franjas';
  end if;
  if not (v -> 'franjas' -> 2 ->> 'cierre')::boolean then raise exception 'el nocturno debería ser cierre'; end if;
  if (v -> 'local' ->> 'fichaje_activo')::boolean then raise exception 'el fichaje no debería venir activado'; end if;
end $$;

-- Una demanda con una franja que no existe se rechaza
do $$ begin
  insert into public.demanda (local_id, dia, franja, puesto, cantidad)
  select id, 1, 'XX', 'conductores', 1 from public.locales where nombre = 'Autobuses C';
  raise exception 'debería exigir una franja existente';
exception when foreign_key_violation then null;
end $$;

-- "L" está reservada para "Libre"
do $$ begin
  perform public.guardar_franjas('[{"franja":"L","etiqueta":"Libre","inicio":"09:00","fin":"10:00","horas":1}]');
  raise exception 'debería rechazar el código L';
exception when check_violation then null;
end $$;

-- ---------- Equipo con reglas propias ----------
insert into public.empleados (id, local_id, nombre, puesto, horas_contrato, min_dias_libres, max_cierres_seguidos, prefiere_librar)
select 'e0000000-0000-0000-0000-0000000000c1', id, 'Andrés', 'conductores', 40, 3, 1, '{5,6}' from public.locales where nombre = 'Autobuses C';
insert into public.empleados (id, local_id, nombre, puesto, horas_contrato)
select 'e0000000-0000-0000-0000-0000000000c2', id, 'Berta', 'conductores', 40 from public.locales where nombre = 'Autobuses C';
insert into public.disponibilidad values
  ('e0000000-0000-0000-0000-0000000000c1', 0, 'L12'), ('e0000000-0000-0000-0000-0000000000c1', 0, 'L7'),
  ('e0000000-0000-0000-0000-0000000000c2', 0, 'NOC');

do $$ begin
  update public.empleados set prefiere_librar = '{7}' where id = 'e0000000-0000-0000-0000-0000000000c1';
  raise exception 'debería rechazar el día 7';
exception when check_violation then null;
end $$;

do $$
declare v jsonb; e jsonb;
begin
  v := public.cargar_local();
  select x into e from jsonb_array_elements(v -> 'empleados') x where x ->> 'nombre' = 'Andrés';
  if (e ->> 'min_dias_libres')::int <> 3 or (e ->> 'max_cierres_seguidos')::int <> 1 then raise exception 'reglas propias: %', e; end if;
  if e -> 'prefiere_librar' <> '[5, 6]'::jsonb then raise exception 'prefiere librar: %', e -> 'prefiere_librar'; end if;
end $$;

-- ---------- Cuadrante con códigos largos ----------
do $$
declare w uuid;
begin
  w := (public.cargar_semana('2026-10-12') -> 'semana' ->> 'id')::uuid;
  perform public.guardar_cuadrante(w, '[{"empleado_id":"e0000000-0000-0000-0000-0000000000c1","dia":0,"franja":"L12"},
                                       {"empleado_id":"e0000000-0000-0000-0000-0000000000c2","dia":0,"franja":"NOC"}]');
  perform public.publicar_semana(w);
  if (select publicado -> 'e0000000-0000-0000-0000-0000000000c2' ->> '0' from public.semanas where id = w) <> 'NOC' then
    raise exception 'la copia publicada perdió el código';
  end if;
  -- Intercambio: los códigos de varias letras no se recortan
  insert into public.solicitudes (id, semana_id, empleado_id, tipo, dia, con_empleado_id)
  values ('50000000-0000-0000-0000-0000000000c1', w, 'e0000000-0000-0000-0000-0000000000c1', 'intercambio', 0, 'e0000000-0000-0000-0000-0000000000c2');
  perform public.aceptar_solicitud('50000000-0000-0000-0000-0000000000c1');
  if (select franja from public.turnos where semana_id = w and empleado_id = 'e0000000-0000-0000-0000-0000000000c1') <> 'NOC'
     or (select franja from public.turnos where semana_id = w and empleado_id = 'e0000000-0000-0000-0000-0000000000c2') <> 'L12' then
    raise exception 'el intercambio no respetó los códigos';
  end if;
end $$;

-- ---------- guardar_franjas: renombrar, añadir, quitar ----------
-- Se quita L7 (sin turnos → se borra) y NOC (con turnos → se archiva); se renombra L12 y se añade Partido.
select public.guardar_franjas('[
  {"franja":"L12","etiqueta":"Línea 12 (centro)","inicio":"06:30","fin":"14:30","horas":8,"cierre":false},
  {"franja":"P1","etiqueta":"Partido","inicio":"10:00","fin":"18:00","horas":7,"cierre":false}]');

do $$
declare v jsonb;
begin
  v := public.cargar_local();
  if (select count(*) from jsonb_array_elements(v -> 'franjas') f where (f ->> 'activa')::boolean) <> 2 then
    raise exception 'deberían quedar 2 franjas activas: %', v -> 'franjas';
  end if;
  if not exists (select 1 from jsonb_array_elements(v -> 'franjas') f where f ->> 'franja' = 'NOC' and not (f ->> 'activa')::boolean) then
    raise exception 'NOC tiene turnos: debería archivarse, no borrarse';
  end if;
  if exists (select 1 from jsonb_array_elements(v -> 'franjas') f where f ->> 'franja' = 'L7') then
    raise exception 'L7 no tenía turnos: debería borrarse';
  end if;
  if exists (select 1 from public.disponibilidad where franja in ('L7', 'NOC')) then
    raise exception 'quedó disponibilidad de franjas quitadas';
  end if;
  if v -> 'franjas' -> 0 ->> 'etiqueta' <> 'Línea 12 (centro)' then raise exception 'no se renombró'; end if;
  -- La franja nueva empieza con todo el equipo disponible (2 personas × 7 días)
  if (select count(*) from public.disponibilidad where franja = 'P1') <> 14 then
    raise exception 'la franja nueva debería tener a todo el equipo disponible';
  end if;
  -- Y la que ya existía conserva lo que tenía (Andrés solo el lunes)
  if (select count(*) from public.disponibilidad where franja = 'L12') <> 1 then
    raise exception 'no se debe tocar la disponibilidad de franjas que ya existían';
  end if;
end $$;

do $$ begin
  perform public.guardar_franjas('[]');
  raise exception 'debería exigir al menos una franja';
exception when raise_exception then
  if sqlerrm not like '%entre 1 y 8%' then raise; end if;
end $$;

-- ---------- Fichajes ----------
-- Sin activar, no se puede fichar
reset role;
set role service_role;
do $$ begin
  perform public.fichar((select token_acceso from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1'));
  raise exception 'no debería fichar con el fichaje desactivado';
exception when raise_exception then
  if sqlerrm not like '%no está activado%' then raise; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
update public.locales set fichaje_activo = true where nombre = 'Autobuses C';

-- El encargado no puede llamar a fichar (solo el servidor)
do $$ begin
  perform public.fichar('x');
  raise exception 'fichar no debería estar abierto a los encargados';
exception when insufficient_privilege then null;
end $$;

-- Ni escribir fichajes a mano (sin pasar por el historial)
do $$ begin
  insert into public.fichajes (local_id, empleado_id, entrada)
  select local_id, id, now() from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1';
  raise exception 'no debería poder insertar fichajes directamente';
exception when insufficient_privilege then null;
end $$;

reset role;
set role service_role;
select public.fichar((select token_acceso from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1')) ->> 'estado' as primera;
-- doble toque: sigue dentro, no se crea un tramo de segundos
do $$ begin
  if public.fichar((select token_acceso from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1')) ->> 'estado' <> 'dentro' then
    raise exception 'el doble toque cerró el tramo';
  end if;
end $$;

-- Pasan 8 horas y ficha la salida
reset role;
update public.fichajes set entrada = now() - interval '8 hours' where empleado_id = 'e0000000-0000-0000-0000-0000000000c1';
set role service_role;
do $$
declare r jsonb;
begin
  r := public.fichar((select token_acceso from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c1'));
  if r ->> 'estado' <> 'fuera' then raise exception 'debería fichar la salida: %', r; end if;
  if (select count(*) from public.fichajes where empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and salida is not null) <> 1 then
    raise exception 'no se cerró el tramo';
  end if;
end $$;

-- Berta entra y se olvida de salir: al día siguiente el tramo queda pendiente de revisar
select public.fichar((select token_acceso from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c2'));
reset role;
update public.fichajes set entrada = now() - interval '20 hours' where empleado_id = 'e0000000-0000-0000-0000-0000000000c2';
set role service_role;
do $$
declare r jsonb;
begin
  r := public.fichar((select token_acceso from public.empleados where id = 'e0000000-0000-0000-0000-0000000000c2'));
  if r ->> 'estado' <> 'dentro' or not (r ->> 'olvidado')::boolean then raise exception 'debería avisar del olvido: %', r; end if;
  if (select count(*) from public.fichajes where empleado_id = 'e0000000-0000-0000-0000-0000000000c2' and sin_salida) <> 1 then
    raise exception 'el tramo olvidado no quedó marcado';
  end if;
end $$;

-- ---------- El encargado revisa y corrige ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);

do $$
declare
  olvidado uuid;
  nuevo uuid;
  v jsonb;
begin
  select id into olvidado from public.fichajes where empleado_id = 'e0000000-0000-0000-0000-0000000000c2' and sin_salida;

  -- sin motivo, no
  begin
    perform public.guardar_fichaje(olvidado, 'e0000000-0000-0000-0000-0000000000c2', now() - interval '20 hours', now() - interval '12 hours', ' ');
    raise exception 'debería exigir motivo';
  exception when raise_exception then
    if sqlerrm not like '%motivo%' then raise; end if;
  end;

  -- salida antes que entrada, no
  begin
    perform public.guardar_fichaje(olvidado, 'e0000000-0000-0000-0000-0000000000c2', now() - interval '12 hours', now() - interval '20 hours', 'Error');
    raise exception 'debería rechazar salida anterior a la entrada';
  exception when raise_exception then
    if sqlerrm not like '%posterior%' then raise; end if;
  end;

  -- corregir el olvido
  perform public.guardar_fichaje(olvidado, 'e0000000-0000-0000-0000-0000000000c2', now() - interval '20 hours', now() - interval '12 hours', 'Olvidó fichar la salida');
  if (select sin_salida or not editado or salida is null from public.fichajes where id = olvidado) then
    raise exception 'la corrección no se aplicó';
  end if;

  -- un tramo que se solapa con otro, no
  begin
    perform public.guardar_fichaje(null, 'e0000000-0000-0000-0000-0000000000c2', now() - interval '19 hours', now() - interval '18 hours', 'Prueba');
    raise exception 'debería rechazar el solape';
  exception when raise_exception then
    if sqlerrm not like '%solapa%' then raise; end if;
  end;

  -- horas futuras, no
  begin
    perform public.guardar_fichaje(null, 'e0000000-0000-0000-0000-0000000000c1', now() + interval '2 hours', now() + interval '3 hours', 'Prueba');
    raise exception 'debería rechazar horas futuras';
  exception when raise_exception then
    if sqlerrm not like '%futuras%' then raise; end if;
  end;

  -- añadir un tramo y luego borrarlo
  nuevo := public.guardar_fichaje(null, 'e0000000-0000-0000-0000-0000000000c1', now() - interval '40 hours', now() - interval '36 hours', 'Fichaje en papel');
  perform public.borrar_fichaje(nuevo, 'Estaba duplicado');
  if exists (select 1 from public.fichajes where id = nuevo) then raise exception 'no se borró'; end if;

  if (select count(*) from public.fichajes_cambios c join public.locales l on l.id = c.local_id where l.nombre = 'Autobuses C') <> 3 then
    raise exception 'el historial debería tener 3 cambios (editar, crear, borrar)';
  end if;
  if (select motivo from public.fichajes_cambios where fichaje_id = nuevo and accion = 'borrar') <> 'Estaba duplicado' then
    raise exception 'el historial perdió el motivo';
  end if;

  -- cargar_fichajes: tramos, turnos previstos con fecha e historial
  v := public.cargar_fichajes(current_date - 3, current_date + 1);
  if jsonb_array_length(v -> 'fichajes') < 3 then raise exception 'faltan fichajes: %', v -> 'fichajes'; end if;
  if jsonb_array_length(v -> 'cambios') <> 3 then raise exception 'faltan cambios: %', v -> 'cambios'; end if;
  v := public.cargar_fichajes('2026-10-12', '2026-10-18');
  if jsonb_array_length(v -> 'turnos') <> 2 or v -> 'turnos' -> 0 ->> 'fecha' <> '2026-10-12' then
    raise exception 'turnos previstos: %', v -> 'turnos';
  end if;

  begin
    perform public.cargar_fichajes('2026-01-01', '2026-12-31');
    raise exception 'debería limitar el periodo';
  exception when raise_exception then
    if sqlerrm not like '%Periodo%' then raise; end if;
  end;
end $$;

-- cargar_semana trae los fichajes cuando el local ficha
do $$
declare v jsonb;
begin
  v := public.cargar_semana(date_trunc('week', now() at time zone 'Europe/Madrid')::date);
  if jsonb_array_length(v -> 'fichajes') < 1 then raise exception 'cargar_semana no trae los fichajes: %', v -> 'fichajes'; end if;
end $$;

-- Una persona que deja el equipo conserva su registro (la ley obliga a guardarlo)
update public.empleados set activo = false where id = 'e0000000-0000-0000-0000-0000000000c1';
do $$
declare v jsonb;
begin
  v := public.cargar_fichajes(current_date - 3, current_date + 1);
  if not exists (select 1 from jsonb_array_elements(v -> 'archivados') a where a ->> 'nombre' = 'Andrés') then
    raise exception 'faltan los archivados: %', v -> 'archivados';
  end if;
end $$;

-- ---------- Otro encargado no ve ni toca nada de esto ----------
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$
declare f uuid;
begin
  if exists (select 1 from public.fichajes) then raise exception 've fichajes ajenos'; end if;
  if exists (select 1 from public.fichajes_cambios) then raise exception 've el historial ajeno'; end if;
  reset role;
  select id into f from public.fichajes limit 1;
  set role authenticated;
  begin
    perform public.borrar_fichaje(f, 'Intento ajeno');
    raise exception 'borró un fichaje ajeno';
  exception when raise_exception then
    if sqlerrm not like '%no encontrado%' then raise; end if;
  end;
  begin
    perform public.guardar_fichaje(null, 'e0000000-0000-0000-0000-0000000000c2', now() - interval '3 hours', now() - interval '2 hours', 'Intento ajeno');
    raise exception 'creó un fichaje ajeno';
  exception when raise_exception then
    if sqlerrm not like '%no encontrado%' then raise; end if;
  end;
end $$;

reset role;
select 'TODAS LAS PRUEBAS DE v3 PASAN' as resultado;
