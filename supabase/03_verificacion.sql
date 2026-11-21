-- Comprobaciones no destructivas: ejecuta cuando termines el script principal.
select 'Celulares' as recurso, count(*) as cantidad from public.gripxell_celulares
union all select 'Publicados', count(*) from public.gripxell_celulares where publicado = true
union all select 'Administradores', count(*) from public.gripxell_administradores
union all select 'Configuración', count(*) from public.gripxell_configuracion
union all select 'Bucket de fotos', count(*) from storage.buckets where id = 'gripxell-celulares';

select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'gripxell_%'
order by tablename;

select id, slug, marca, modelo, publicado, disponible,
       foto_frontal_path is not null as tiene_frente,
       foto_trasera_path is not null as tiene_reverso
from public.gripxell_celulares
order by creado_en desc
limit 30;
