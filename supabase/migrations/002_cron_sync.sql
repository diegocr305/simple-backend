-- ============================================================
-- CRON OIRS  (modelo V4 - por eventos)
-- ============================================================
-- El modelo antiguo hacia POLLING cada 10 minutos (~3.700 llamadas/dia
-- para pocas solicitudes reales). Con el modelo V4 SIMPLE (proceso 22)
-- llama a las Edge Functions en tiempo real por cada transicion, asi que
-- el polling ya no es necesario.
--
-- En su lugar dejamos UN job DIARIO al final del dia como base para la
-- Reconciliacion (spec R10.6): comparar SIMPLE vs Supabase y reparar.
--
-- IMPORTANTE: estos comandos requieren la API cron.* (no UPDATE directo a
-- cron.job, que da "permission denied"). Se ejecutan en SQL Editor.

-- 1. Quitar el polling viejo (si existe)
-- select cron.unschedule('sync-oirs-auto');

-- 2. Job diario de reconciliacion  (00:00 UTC = 20:00 America/Santiago)
-- select cron.schedule(
--   'oirs-reconciliacion-diaria',
--   '0 0 * * *',
--   $$
--   select net.http_post(
--     url := 'https://gyhihuovussdauehmeuk.supabase.co/functions/v1/oirs-reconciliar',
--     headers := jsonb_build_object('Content-Type','application/json','x-simple-token','<SIMPLE_API_TOKEN>'),
--     body := '{"evento":"reconciliacion"}'::jsonb
--   );
--   $$
-- );

-- 3. Se deja DESACTIVADO hasta implementar la Edge Function 'oirs-reconciliar'
-- select cron.alter_job(job_id := <id>, active := false);

-- Estado aplicado en produccion (2026-09-09):
--   * 'sync-oirs-auto'             -> ELIMINADO
--   * 'oirs-reconciliacion-diaria' -> creado, schedule '0 0 * * *', active = false
--
-- Ver jobs:      select jobid, jobname, schedule, active from cron.job;
-- Activar luego: select cron.alter_job(job_id := <id>, active := true);
