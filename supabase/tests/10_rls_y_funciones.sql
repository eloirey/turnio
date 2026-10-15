-- Pruebas de la migración: seguridad por local y operaciones atómicas.
-- Cada bloque lanza una excepción si algo no cumple lo esperado.
\set ON_ERROR_STOP on

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- ---------- Encargado A monta su local ----------
insert into public.locales (id, owner_id, nombre)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bar A');
insert into public.puestos (local_id, clave, nombre) values ('aaaaaaaa-0000-0000-0000-000000000001', 'barra', 'Barra');
insert into public.empleados (id, local_id, nombre, puesto, horas_contrato) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Laura', 'barra', 32),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Pol', 'barra', 16);
insert into public.semanas (id, local_id, fecha_inicio)
values ('5e000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-12');

-- Desde v3 las franjas las crea crear_local; aquí el local se crea a mano.
-- (antes de v3 las crea un disparador; por eso "on conflict do nothing").
insert into public.franjas (local_id, franja, etiqueta, inicio, fin, horas) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'M', 'Mañana', '09:00', '17:00', 8),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'T', 'Tarde', '13:00', '21:00', 8),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'N', 'Noche', '17:00', '01:00', 8)
on conflict do nothing;
do $$ begin
  if (select count(*) from public.franjas) <> 3 then raise exception 'faltan las franjas'; end if;
end $$;

-- ---------- guardar_cuadrante ----------
select public.guardar_cuadrante('5e000000-0000-0000-0000-000000000001', '[
  {"empleado_id": "e0000000-0000-0000-0000-000000000001", "dia": 1, "franja": "N"},
  {"empleado_id": "e0000000-0000-0000-0000-000000000001", "dia": 2, "franja": "N"},
  {"empleado_id": "e0000000-0000-0000-0000-000000000002", "dia": 5, "franja": "T"}
]');
do $$ begin
  if (select count(*) from public.turnos) <> 3 then raise exception 'guardar_cuadrante no insertó 3 turnos'; end if;
end $$;

-- Guardar de nuevo sustituye (no duplica)
select public.guardar_cuadrante('5e000000-0000-0000-0000-000000000001', '[
  {"empleado_id": "e0000000-0000-0000-0000-000000000001", "dia": 1, "franja": "N"},
  {"empleado_id": "e0000000-0000-0000-0000-000000000002", "dia": 5, "franja": "T"}
]');
do $$ begin
  if (select count(*) from public.turnos) <> 2 then raise exception 'guardar_cuadrante debería sustituir'; end if;
end $$;

-- ---------- publicar_semana ----------
select public.publicar_semana('5e000000-0000-0000-0000-000000000001');
do $$
declare s public.semanas;
begin
  select * into s from public.semanas where id = '5e000000-0000-0000-0000-000000000001';
  if s.estado <> 'publicado' then raise exception 'estado debería ser publicado'; end if;
  if s.publicado -> 'e0000000-0000-0000-0000-000000000001' ->> '1' <> 'N' then raise exception 'snapshot incorrecto: %', s.publicado; end if;
end $$;

-- Editar después de publicar → "cambios", pero la copia publicada no cambia
select public.guardar_cuadrante('5e000000-0000-0000-0000-000000000001', '[]');
do $$
declare s public.semanas;
begin
  select * into s from public.semanas where id = '5e000000-0000-0000-0000-000000000001';
  if s.estado <> 'cambios' then raise exception 'estado debería ser cambios'; end if;
  if s.publicado = '{}'::jsonb then raise exception 'la copia publicada no debería cambiar al editar'; end if;
end $$;

-- ---------- aceptar_solicitud: intercambio ----------
select public.guardar_cuadrante('5e000000-0000-0000-0000-000000000001', '[
  {"empleado_id": "e0000000-0000-0000-0000-000000000001", "dia": 5, "franja": "N"},
  {"empleado_id": "e0000000-0000-0000-0000-000000000002", "dia": 5, "franja": "T"}
]');
insert into public.solicitudes (id, semana_id, empleado_id, tipo, dia, con_empleado_id)
values ('50000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001', 'intercambio', 5, 'e0000000-0000-0000-0000-000000000002');
select public.aceptar_solicitud('50000000-0000-0000-0000-000000000001');
do $$ begin
  if (select franja from public.turnos where empleado_id = 'e0000000-0000-0000-0000-000000000001' and dia = 5) <> 'T'
    or (select franja from public.turnos where empleado_id = 'e0000000-0000-0000-0000-000000000002' and dia = 5) <> 'N'
  then raise exception 'el intercambio no se aplicó'; end if;
  if (select estado from public.solicitudes where id = '50000000-0000-0000-0000-000000000001') <> 'aceptada'
  then raise exception 'la solicitud debería quedar aceptada'; end if;
end $$;

-- ---------- aceptar_solicitud: librar ----------
insert into public.solicitudes (id, semana_id, empleado_id, tipo, dia)
values ('50000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000002', 'librar', 5);
select public.aceptar_solicitud('50000000-0000-0000-0000-000000000002');
do $$ begin
  if exists (select 1 from public.turnos where empleado_id = 'e0000000-0000-0000-0000-000000000002' and dia = 5)
  then raise exception 'librar no borró el turno'; end if;
end $$;

-- Aceptar dos veces la misma solicitud falla
do $$ begin
  perform public.aceptar_solicitud('50000000-0000-0000-0000-000000000002');
  raise exception 'debería haber fallado';
exception when raise_exception then
  if sqlerrm = 'debería haber fallado' then raise; end if;
end $$;

-- ---------- Encargado B no puede ver ni tocar nada de A ----------
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if (select count(*) from public.locales) <> 0 then raise exception 'B ve locales ajenos'; end if;
  if (select count(*) from public.turnos) <> 0 then raise exception 'B ve turnos ajenos'; end if;
end $$;

do $$ begin
  perform public.guardar_cuadrante('5e000000-0000-0000-0000-000000000001', '[]');
  raise exception 'B no debería poder guardar';
exception when raise_exception then
  if sqlerrm <> 'Semana no encontrada' then raise; end if;
end $$;

do $$ begin
  insert into public.empleados (local_id, nombre, puesto, horas_contrato)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Intruso', 'sala', 10);
  raise exception 'B no debería poder crear empleados en el local de A';
exception when insufficient_privilege then null;
end $$;

-- anon (sin sesión) no puede ejecutar las funciones
reset role;
set role anon;
do $$ begin
  perform public.publicar_semana('5e000000-0000-0000-0000-000000000001');
  raise exception 'anon no debería poder publicar';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'TODAS LAS PRUEBAS DE BASE DE DATOS PASAN' as resultado;
