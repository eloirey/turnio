-- Pruebas de la migración v7: avisos resueltos. Usa «Autobuses C» de 30_v3.sql.
\set ON_ERROR_STOP on

reset role;
update public.locales set fichaje_activo = true where nombre = 'Autobuses C';
update public.empleados set activo = true where id in ('e0000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c2');
delete from public.avisos where local_id = (select id from public.locales where nombre = 'Autobuses C');

-- Una solicitud crea un aviso que apunta a ella; al aceptarla queda «Aceptada»
insert into public.solicitudes (semana_id, empleado_id, tipo, dia, mensaje)
select s.id, 'e0000000-0000-0000-0000-0000000000c1', 'librar', 2, 'Médico'
from public.semanas s join public.locales l on l.id = s.local_id where l.nombre = 'Autobuses C' limit 1;
do $$
declare sol uuid; av public.avisos;
begin
  select id into sol from public.solicitudes where empleado_id = 'e0000000-0000-0000-0000-0000000000c1' and mensaje = 'Médico' order by created_at desc limit 1;
  select * into av from public.avisos where ref_tipo = 'solicitud' and ref_id = sol;
  if av.id is null or av.empleado_id is not null then raise exception 'el aviso de la solicitud debe apuntar a ella'; end if;
  update public.solicitudes set estado = 'rechazada' where id = sol;
  select * into av from public.avisos where id = av.id;
  if av.resuelto is distinct from 'Rechazada' or av.leido_en is null then raise exception 'al rechazarla, el aviso queda «Rechazada» y leído'; end if;
end $$;

-- Un olvido de salida: avisos al encargado y al empleado; al corregirlo, «Corregido»
insert into public.fichajes (local_id, empleado_id, entrada, sin_salida)
select l.id, 'e0000000-0000-0000-0000-0000000000c2', now() - interval '40 hours', true from public.locales l where l.nombre = 'Autobuses C';
do $$
declare f uuid;
begin
  select id into f from public.fichajes where empleado_id = 'e0000000-0000-0000-0000-0000000000c2' and sin_salida order by entrada desc limit 1;
  if (select count(*) from public.avisos where ref_tipo = 'fichaje' and ref_id = f) <> 2 then raise exception 'el olvido avisa a los dos y apunta al fichaje'; end if;
  update public.fichajes set salida = entrada + interval '8 hours', sin_salida = false, editado = true where id = f;
  if exists (select 1 from public.avisos where ref_tipo = 'fichaje' and ref_id = f and resuelto is distinct from 'Corregido') then
    raise exception 'al corregirlo, los avisos quedan «Corregido»';
  end if;
end $$;

-- «Hecho» a mano: solo el encargado del local
insert into public.avisos (local_id, tipo, titulo, ref_tipo, ref_id)
select id, 'fichaje', 'Prueba fuera', 'fichaje', gen_random_uuid() from public.locales where nombre = 'Autobuses C';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.marcar_aviso_hecho((select id from public.avisos where titulo = 'Prueba fuera'));
reset role;
do $$ begin
  if (select resuelto from public.avisos where titulo = 'Prueba fuera') is not null then raise exception 'otro encargado no puede marcarlo'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select public.marcar_aviso_hecho((select id from public.avisos where titulo = 'Prueba fuera'));
reset role;
do $$ begin
  if (select resuelto from public.avisos where titulo = 'Prueba fuera') is distinct from 'Hecho' then raise exception 'el encargado lo marca como hecho'; end if;
end $$;
select 'TODAS LAS PRUEBAS DE v7 PASAN' as resultado;
