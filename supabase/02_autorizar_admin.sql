-- PASO 2 - Ejecutar DESPUÉS de crear el usuario en Supabase > Authentication > Users.
-- REEMPLAZA el texto TU-UUID-AQUI por el identificador UUID del usuario real.
-- Si no lo reemplazas, la consulta fallará SIN modificar usuarios.
insert into public.gripxell_administradores (user_id)
values ('TU-UUID-AQUI'::uuid)
on conflict (user_id) do nothing;

-- Lista de UID administradores (no devuelve emails ni contraseñas).
select user_id, creado_en
from public.gripxell_administradores
order by creado_en desc;
