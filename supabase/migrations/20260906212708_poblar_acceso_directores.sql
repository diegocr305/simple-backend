INSERT INTO matriculas.acceso_establecimiento (correo, id_establecimiento, rol, es_principal, activo)
SELECT lower(trim(s.correo_director)), e.id_establecimiento, 'Colegio', true, true
FROM matriculas.establecimiento e
JOIN public.slep_establecimientos s ON e.slep_establecimiento_id = s.id
WHERE s.correo_director IS NOT NULL AND trim(s.correo_director) <> ''
ON CONFLICT (correo, id_establecimiento) DO NOTHING;;
