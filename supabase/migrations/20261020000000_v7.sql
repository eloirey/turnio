-- Rotafy v7: avisos resueltos.
-- Un aviso que pide hacer algo (una solicitud, un olvido de fichaje, un
-- fichaje fuera del local) queda marcado como resuelto cuando se hace:
-- «Aceptada», «Rechazada», «Corregido»… o a mano con «Hecho».
-- Se puede ejecutar sobre una base con datos.

alter table public.avisos
  add column if not exists ref_tipo text check (ref_tipo in ('solicitud', 'fichaje')),
  add column if not exists ref_id uuid,
  add column if not exists resuelto text check (char_length(resuelto) <= 40),
  add column if not exists resuelto_en timestamptz;
create index if not exists avisos_ref on public.avisos (ref_tipo, ref_id) where ref_id is not null;

-- Los avisos que se crean ahora apuntan a lo que hay que resolver.
create or replace function public.aviso_solicitud_nueva()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  sem public.semanas;
  quien text;
  con text;
  dia date;
begin
  select * into sem from public.semanas where id = new.semana_id;
  select nombre into quien from public.empleados where id = new.empleado_id;
  dia := sem.fecha_inicio + new.dia;
  if new.tipo = 'librar' then
    insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace, ref_tipo, ref_id)
    values (sem.local_id, 'solicitud', quien || ' pide librar el ' || public.fecha_corta(dia),
            nullif(new.mensaje, ''), '/app/cuadrante?semana=' || sem.fecha_inicio, 'solicitud', new.id);
  else
    select nombre into con from public.empleados where id = new.con_empleado_id;
    insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace, ref_tipo, ref_id)
    values (sem.local_id, 'solicitud', quien || ' quiere cambiar el turno del ' || public.fecha_corta(dia) || ' con ' || coalesce(con, 'un compañero'),
            nullif(new.mensaje, ''), '/app/cuadrante?semana=' || sem.fecha_inicio, 'solicitud', new.id);
  end if;
  return new;
end;
$$;

create or replace function public.aviso_fichaje_sin_salida()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  quien text;
  dia date := (new.entrada at time zone 'Europe/Madrid')::date;
  lunes date := dia - (extract(isodow from dia)::int - 1);
begin
  if not new.sin_salida or (tg_op = 'UPDATE' and old.sin_salida) then return new; end if;
  select nombre into quien from public.empleados where id = new.empleado_id;
  insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace, ref_tipo, ref_id)
  values (new.local_id, 'fichaje', quien || ' no fichó la salida el ' || public.fecha_corta(dia),
          'Pon la hora real en Fichajes para que cuenten sus horas.', '/app/fichajes?semana=' || lunes, 'fichaje', new.id);
  insert into public.avisos (local_id, empleado_id, tipo, titulo, cuerpo, ref_tipo, ref_id)
  values (new.local_id, new.empleado_id, 'fichaje', 'No fichaste la salida el ' || public.fecha_corta(dia),
          'Tu encargado pondrá la hora real. Si quieres, díselo tú.', 'fichaje', new.id);
  return new;
end;
$$;

create or replace function public.aviso_fichaje_fuera()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  quien text;
  momento text;
  dist integer;
  dia date := (new.entrada at time zone 'Europe/Madrid')::date;
  lunes date := dia - (extract(isodow from dia)::int - 1);
begin
  if tg_op = 'INSERT' and new.ubicacion_entrada = 'fuera' then
    momento := 'la entrada'; dist := new.distancia_entrada_m;
  elsif tg_op = 'UPDATE' and new.ubicacion_salida = 'fuera' and old.ubicacion_salida is distinct from 'fuera' then
    momento := 'la salida'; dist := new.distancia_salida_m;
  else
    return new;
  end if;
  select nombre into quien from public.empleados where id = new.empleado_id;
  insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace, ref_tipo, ref_id)
  values (new.local_id, 'fichaje', quien || ' fichó ' || momento || ' fuera del local',
          case when dist is null then 'El ' || public.fecha_corta(dia) || '.'
               when dist >= 1000 then 'El ' || public.fecha_corta(dia) || ', a unos ' || replace(round(dist / 1000.0, 1)::text, '.', ',') || ' km.'
               else 'El ' || public.fecha_corta(dia) || ', a unos ' || dist || ' m.' end,
          '/app/fichajes?semana=' || lunes, 'fichaje', new.id);
  return new;
end;
$$;

-- Resolver los avisos de algo: los marca como resueltos y leídos.
create or replace function public.resolver_avisos_de(p_tipo text, p_id uuid, p_texto text)
returns void
language sql security definer set search_path = ''
as $$
  update public.avisos
  set resuelto = p_texto, resuelto_en = now(), leido_en = coalesce(leido_en, now())
  where ref_tipo = p_tipo and ref_id = p_id and resuelto is null;
$$;
revoke execute on function public.resolver_avisos_de(text, uuid, text) from public, anon, authenticated;

-- Solicitud aceptada o rechazada.
create or replace function public.resolver_aviso_solicitud()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.estado = 'pendiente' and new.estado <> 'pendiente' then
    perform public.resolver_avisos_de('solicitud', new.id, case new.estado when 'aceptada' then 'Aceptada' else 'Rechazada' end);
  end if;
  return new;
end;
$$;
revoke execute on function public.resolver_aviso_solicitud() from public, anon, authenticated;
drop trigger if exists resolver_aviso_solicitud on public.solicitudes;
create trigger resolver_aviso_solicitud after update of estado on public.solicitudes
  for each row execute function public.resolver_aviso_solicitud();

-- Fichaje corregido por el encargado (o borrado).
create or replace function public.resolver_aviso_fichaje()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.resolver_avisos_de('fichaje', old.id, 'Borrado');
    return old;
  end if;
  if new.editado and (new.entrada, new.salida, new.sin_salida) is distinct from (old.entrada, old.salida, old.sin_salida) then
    perform public.resolver_avisos_de('fichaje', new.id, 'Corregido');
  end if;
  return new;
end;
$$;
revoke execute on function public.resolver_aviso_fichaje() from public, anon, authenticated;
drop trigger if exists resolver_aviso_fichaje on public.fichajes;
create trigger resolver_aviso_fichaje after update or delete on public.fichajes
  for each row execute function public.resolver_aviso_fichaje();

-- «Hecho»: el encargado da por resuelto un aviso a mano (p. ej. ya ha hablado
-- con quien fichó fuera del local).
create or replace function public.marcar_aviso_hecho(p_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.avisos a
  set resuelto = 'Hecho', resuelto_en = now(), leido_en = coalesce(a.leido_en, now())
  where a.id = p_id and a.empleado_id is null and a.resuelto is null and public.es_mi_local(a.local_id);
$$;
revoke execute on function public.marcar_aviso_hecho(uuid) from public, anon;
grant execute on function public.marcar_aviso_hecho(uuid) to authenticated;
