-- Pruebas de la migración v6: fichaje_desde. Usa el local «Autobuses C» de 30_v3.sql.
\set ON_ERROR_STOP on

reset role;
update public.locales set fichaje_activo = false where nombre = 'Autobuses C';
update public.locales set fichaje_activo = true where nombre = 'Autobuses C';
do $$ begin
  if (select fichaje_desde from public.locales where nombre = 'Autobuses C') <> (now() at time zone 'Europe/Madrid')::date then
    raise exception 'al activar el fichaje se apunta el día';
  end if;
end $$;

-- Cambiar otra cosa no toca la fecha
update public.locales set fichaje_desde = '2026-01-01' where nombre = 'Autobuses C';
update public.locales set nombre = 'Autobuses C' where nombre = 'Autobuses C';
update public.locales set fichaje_activo = true where nombre = 'Autobuses C';
do $$ begin
  if (select fichaje_desde from public.locales where nombre = 'Autobuses C') <> '2026-01-01' then
    raise exception 'si ya estaba activo, la fecha no cambia';
  end if;
end $$;

-- cargar_local la devuelve
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  if (public.cargar_local() -> 'local' ->> 'fichaje_desde') <> '2026-01-01' then
    raise exception 'cargar_local debe devolver fichaje_desde';
  end if;
end $$;
reset role;
select 'TODAS LAS PRUEBAS DE v6 PASAN' as resultado;
