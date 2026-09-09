CREATE TABLE matriculas.backup_nivel_ensenanza_20260908 AS
SELECT id_matricula, nivel_ensenanza, curso, cod_tipo_ensenanza
FROM matriculas.matricula;

SELECT count(*) AS filas_respaldadas FROM matriculas.backup_nivel_ensenanza_20260908;;
