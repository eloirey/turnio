-- ============================================================
-- Rotafy v4: avisos (la campanita)
--
-- Cada aviso es para el encargado de un local (empleado_id null) o para una
-- persona concreta del equipo. Los crean solos unos triggers:
--   · una persona pide librar o un cambio          → encargado
--   · el encargado acepta o rechaza la solicitud    → esa persona (y su compañero)
--   · se publica el horario o cambia               → cada persona afectada
--   · alguien olvida fichar la salida              → encargado y esa persona
--   · el encargado corrige un fichaje              → esa persona
-- Y Rotafy puede mandar anuncios a todos con publicar_anuncio() desde el
-- editor SQL de Supabase.
-- ============================================================

create table public.avisos (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references public.locales (id) on delete cascade,
  empleado_id  uuid references public.empleados (id) on delete cascade, -- null = encargado
  tipo         text not null check (tipo in ('solicitud', 'solicitud_resuelta', 'horario', 'fichaje', 'anuncio')),
  titulo       text not null check (char_length(titulo) between 1 and 160),
  cuerpo       text check (char_length(cuerpo) <= 1000),
  enlace       text check (char_length(enlace) <= 300),
  creado_en    timestamptz not null default now(),
  leido_en     timestamptz
);
create index avisos_encargado on public.avisos (local_id, creado_en desc) where empleado_id is null;
create index avisos_empleado on public.avisos (empleado_id, creado_en desc) where empleado_id is not null;

alter table public.avisos enable row level security;
-- El encargado solo LEE los suyos; marcarlos como leídos va por leer_avisos().
-- Los avisos de los empleados se sirven desde el servidor con la service role.
create policy "avisos del encargado" on public.avisos
  for select to authenticated using (empleado_id is null and public.es_mi_local(local_id));

-- Marca como leídos los avisos del encargado.
create function public.leer_avisos()
returns void
language sql security definer set search_path = ''
as $$
  update public.avisos a set leido_en = now()
  where a.empleado_id is null and a.leido_en is null
    and a.local_id in (select l.id from public.locales l where l.owner_id = (select auth.uid()));
$$;
revoke execute on function public.leer_avisos() from public, anon;
grant execute on function public.leer_avisos() to authenticated;

-- ---------- Fechas en español para los textos ----------
create function public.fecha_corta(d date)
returns text
language sql immutable set search_path = ''
as $$
  select (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from d)::int]
         || ' ' || extract(day from d)::int;
$$;

create function public.rango_semana(lunes date)
returns text
language sql immutable set search_path = ''
as $$
  select extract(day from lunes)::int
         || case when extract(month from lunes) = extract(month from lunes + 6) then ''
                 else ' de ' || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from lunes)::int] end
         || ' al ' || extract(day from lunes + 6)::int || ' de '
         || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from lunes + 6)::int];
$$;

-- ---------- Solicitudes ----------
create function public.aviso_solicitud_nueva()
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
    insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace)
    values (sem.local_id, 'solicitud', quien || ' pide librar el ' || public.fecha_corta(dia),
            nullif(new.mensaje, ''), '/app/cuadrante?semana=' || sem.fecha_inicio);
  else
    select nombre into con from public.empleados where id = new.con_empleado_id;
    insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace)
    values (sem.local_id, 'solicitud', quien || ' quiere cambiar el turno del ' || public.fecha_corta(dia) || ' con ' || coalesce(con, 'un compañero'),
            nullif(new.mensaje, ''), '/app/cuadrante?semana=' || sem.fecha_inicio);
  end if;
  return new;
end;
$$;
create trigger avisar_solicitud_nueva after insert on public.solicitudes
  for each row execute function public.aviso_solicitud_nueva();

create function public.aviso_solicitud_resuelta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  sem public.semanas;
  quien text;
  con text;
  dia date;
  que text;
begin
  if old.estado <> 'pendiente' or new.estado = 'pendiente' then return new; end if;
  select * into sem from public.semanas where id = new.semana_id;
  dia := sem.fecha_inicio + new.dia;
  select nombre into quien from public.empleados where id = new.empleado_id;
  select nombre into con from public.empleados where id = new.con_empleado_id;
  que := case when new.tipo = 'librar' then 'librar el ' || public.fecha_corta(dia)
              else 'cambiar el turno del ' || public.fecha_corta(dia) || ' con ' || coalesce(con, 'tu compañero') end;
  insert into public.avisos (local_id, empleado_id, tipo, titulo, cuerpo)
  values (sem.local_id, new.empleado_id, 'solicitud_resuelta',
          case when new.estado = 'aceptada' then 'Aceptado: ' else 'No aceptado: ' end || que,
          case when new.estado = 'aceptada' then 'Tu horario ya está actualizado.' else 'Si tienes dudas, habla con tu encargado.' end);
  if new.estado = 'aceptada' and new.tipo = 'intercambio' and new.con_empleado_id is not null then
    insert into public.avisos (local_id, empleado_id, tipo, titulo, cuerpo)
    values (sem.local_id, new.con_empleado_id, 'solicitud_resuelta',
            'Cambias el turno del ' || public.fecha_corta(dia) || ' con ' || coalesce(quien, 'un compañero'),
            'Tu encargado ha aceptado el cambio. Revisa tu horario.');
  end if;
  return new;
end;
$$;
create trigger avisar_solicitud_resuelta after update of estado on public.solicitudes
  for each row execute function public.aviso_solicitud_resuelta();

-- ---------- Horario publicado ----------
-- Al publicar por primera vez, avisa a quien tiene turnos. Al volver a
-- publicar, solo a quien le ha cambiado algo.
create function public.aviso_horario_publicado()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rango text := public.rango_semana(new.fecha_inicio);
begin
  if new.publicado_at is not distinct from old.publicado_at or new.publicado is null then return new; end if;
  if old.publicado is null then
    insert into public.avisos (local_id, empleado_id, tipo, titulo)
    select new.local_id, k::uuid, 'horario', 'Ya está tu horario del ' || rango
    from jsonb_object_keys(new.publicado) k
    join public.empleados e on e.id = k::uuid and e.activo;
  else
    insert into public.avisos (local_id, empleado_id, tipo, titulo, cuerpo)
    select new.local_id, e.id, 'horario', 'Ha cambiado tu horario del ' || rango, 'Revisa tus turnos de esa semana.'
    from public.empleados e
    where e.local_id = new.local_id and e.activo
      and coalesce(new.publicado -> e.id::text, '{}'::jsonb) <> coalesce(old.publicado -> e.id::text, '{}'::jsonb);
  end if;
  return new;
end;
$$;
create trigger avisar_horario_publicado after update of publicado_at on public.semanas
  for each row execute function public.aviso_horario_publicado();

-- ---------- Fichajes ----------
create function public.aviso_fichaje_sin_salida()
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
  insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace)
  values (new.local_id, 'fichaje', quien || ' no fichó la salida el ' || public.fecha_corta(dia),
          'Pon la hora real en Fichajes para que cuenten sus horas.', '/app/fichajes?semana=' || lunes);
  insert into public.avisos (local_id, empleado_id, tipo, titulo, cuerpo)
  values (new.local_id, new.empleado_id, 'fichaje', 'No fichaste la salida el ' || public.fecha_corta(dia),
          'Tu encargado pondrá la hora real. Si quieres, díselo tú.');
  return new;
end;
$$;
create trigger avisar_fichaje_sin_salida after insert or update of sin_salida on public.fichajes
  for each row execute function public.aviso_fichaje_sin_salida();

create function public.aviso_fichaje_corregido()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ref jsonb := coalesce(new.despues, new.antes);
  dia date := ((ref ->> 'entrada')::timestamptz at time zone 'Europe/Madrid')::date;
begin
  if dia is null or not exists (select 1 from public.empleados where id = new.empleado_id) then return new; end if;
  insert into public.avisos (local_id, empleado_id, tipo, titulo, cuerpo)
  values (new.local_id, new.empleado_id, 'fichaje',
          case new.accion when 'crear' then 'Tu encargado ha añadido un fichaje el '
                          when 'borrar' then 'Tu encargado ha borrado un fichaje del '
                          else 'Tu encargado ha corregido tu fichaje del ' end || public.fecha_corta(dia),
          'Motivo: ' || new.motivo);
  return new;
end;
$$;
create trigger avisar_fichaje_corregido after insert on public.fichajes_cambios
  for each row execute function public.aviso_fichaje_corregido();

-- ---------- Anuncios de Rotafy ----------
-- Desde el editor SQL de Supabase, por ejemplo:
--   select public.publicar_anuncio('Novedad: exporta el cuadrante a Excel', 'Está en Cuadrante → Más.', 'encargados');
-- p_para: 'encargados', 'empleados' o 'todos'. Devuelve cuántos avisos ha creado.
create function public.publicar_anuncio(p_titulo text, p_cuerpo text default null, p_para text default 'encargados', p_enlace text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer := 0;
  c integer;
begin
  if p_para not in ('encargados', 'empleados', 'todos') then raise exception 'p_para debe ser encargados, empleados o todos'; end if;
  if p_para in ('encargados', 'todos') then
    insert into public.avisos (local_id, tipo, titulo, cuerpo, enlace)
    select id, 'anuncio', p_titulo, p_cuerpo, p_enlace from public.locales;
    get diagnostics c = row_count; n := n + c;
  end if;
  if p_para in ('empleados', 'todos') then
    insert into public.avisos (local_id, empleado_id, tipo, titulo, cuerpo, enlace)
    select local_id, id, 'anuncio', p_titulo, p_cuerpo, p_enlace from public.empleados where activo;
    get diagnostics c = row_count; n := n + c;
  end if;
  return n;
end;
$$;
-- Solo desde el editor SQL (rol postgres): nadie más puede mandar anuncios.
revoke execute on function public.publicar_anuncio(text, text, text, text) from public, anon, authenticated;

-- Las funciones de los triggers no se llaman a mano.
revoke execute on function public.aviso_solicitud_nueva() from public, anon, authenticated;
revoke execute on function public.aviso_solicitud_resuelta() from public, anon, authenticated;
revoke execute on function public.aviso_horario_publicado() from public, anon, authenticated;
revoke execute on function public.aviso_fichaje_sin_salida() from public, anon, authenticated;
revoke execute on function public.aviso_fichaje_corregido() from public, anon, authenticated;
