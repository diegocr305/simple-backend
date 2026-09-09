# Requirements Document

## Introduction

La aplicacion actual (Ionic Angular + Supabase) sincroniza tramites OIRS desde SIMPLE cada 10 minutos y permite consultarlos (Dashboard, Seguimiento, Detalle). Es una capa de **solo lectura**.

Esta especificacion agrega una **capa de gestion liviana** cuyo proposito es: **notificar, rastrear, recordar y revisar todos** los casos OIRS. La respuesta formal al ciudadano se escribe en SIMPLE; esta app no la reemplaza.

El problema que SIMPLE no resuelve: cuando un caso pasa por mas de un area y se necesita mas de un insumo. El flujo de SIMPLE es lineal con un solo paso de derivacion, asi que atender multiples areas en paralelo obliga al analista a cadenas de correo donde pierde el rastro. El **Rastreador de Insumos en Paralelo** es la pieza central de esta especificacion.

**Principio rector:** la idea es que sea simple y que se responda lo mas rapido posible. Toda funcion que agregue pasos sin reducir tiempo de respuesta queda fuera del alcance inicial.

**Restriccion arquitectonica:** SIMPLE sigue siendo el sistema de registro del flujo cara al ciudadano. Esta aplicacion es la capa de gestion interna y reporteria.

**Restriccion de integridad de datos:** la ingesta (eventos + reconciliacion diaria) sobrescribe hoy las columnas area_derivada, funcionario_asignado, prioridad, respuesta y fecha_vencimiento de seguimiento_oirs_siac. Ninguna accion de gestion puede quedar almacenada en columnas que la ingesta sobrescriba.

**Problema de seguridad identificado:** el token de la API de SIMPLE esta actualmente en src/environments/environment.ts y se envia al navegador. Debe moverse al servidor.
## Glossary

- **OIRS**: Oficina de Informaciones, Reclamos y Sugerencias.
- **SIAC**: Sistema de Atencion Ciudadana. Equipo del Depto. de Atencion y Participacion Ciudadana que opera la OIRS.
- **SIMPLE**: Plataforma de tramitacion en linea del SLEP Valparaiso. Proceso OIRS = 14.
- **Tramite**: Caso OIRS individual originado en SIMPLE, identificado por folio_simple (formato SMP-{id}).
- **Etapa**: Tarea del flujo SIMPLE asociada a un tramite. IDs conocidos: 54 (Ingreso), 55 (Revision), 56 (Derivacion, supuesto), 57 (Revision Final, supuesto).
- **Solicitud_Insumo**: Solicitud de aporte enviada por el equipo SIAC a una Contraparte_Interna, asociada a un Tramite.
- **Insumo**: Contenido (texto y/o adjunto) recibido de una Contraparte_Interna en respuesta a una Solicitud_Insumo.
- **Contraparte_Interna**: Funcionario o departamento distinto de SIAC que recibe una Solicitud_Insumo.
- **Evento_SIMPLE**: Llamada HTTP que SIMPLE realiza a nuestro endpoint al transitar una tarea, mediante la funcionalidad tarea externa.
- **Reconciliacion**: Pasada diaria que compara el estado actual de SIMPLE contra Supabase y repara diferencias.
- **Dia_Habil**: Dia de lunes a viernes que no es feriado legal en Chile.
- **Plazo_Legal**: Cantidad de dias habiles para responder un tramite, segun tipo de solicitud y normativa aplicable.
- **Etiqueta_Interna**: Valor de clasificacion interna para reporteria (tematica, subtematica, departamento responsable, unidad, tipo de requirente).
- **Unidad**: Nivel superior de la estructura organizacional. Valores: GABINETE, UGDP, UATP, UAF, UGVT, UPyCG.
- **Departamento**: Area responsable dependiente de una Unidad.
- **Backend_Gestion**: Conjunto de servicios de esta especificacion.
- **Motor_Plazos**: Componente que calcula fechas de vencimiento y dias habiles restantes.
- **Servicio_Notificaciones**: Componente que evalua reglas de alerta y envia correos.
- **Catalogo_Interno**: Componente que administra las Etiqueta_Interna y la estructura organizacional.
- **Sincronizador_SIMPLE**: Edge Function sync-oirs y la logica de ingesta (eventos + reconciliacion).
- **Modulo_Reporteria**: Componente que expone vistas agregadas, tableros y exportaciones.
- **Registro_Auditoria**: Bitacora de acciones de gestion.
- **Rol_SIAC**: Puede gestionar tramites, crear solicitudes de insumo, clasificar y enviar alertas.
- **Rol_Contraparte**: Puede responder solicitudes de insumo asignadas a su Departamento.
- **Rol_Jefatura**: Lectura ampliada y recepcion de alertas en copia.
- **Rol_Admin**: Mantiene el Catalogo_Interno y la configuracion de notificaciones.
## Requirements

### Requerimiento 1: Roles y atribuciones de gestion

**Historia de usuario:** Como analista SIAC, quiero que solo mi equipo pueda gestionar los tramites, para que las contrapartes internas se limiten a responder sus insumos.

#### Criterios de Aceptacion

1. EL Backend_Gestion DEBERA reconocer los roles Rol_SIAC, Rol_Contraparte, Rol_Jefatura y Rol_Admin a partir del campo rol de la tabla usuarios.
2. CUANDO un usuario con Rol_SIAC crea una Solicitud_Insumo, EL Backend_Gestion DEBERA persistirla.
3. SI un usuario sin Rol_SIAC intenta crear una Solicitud_Insumo, ENTONCES EL Backend_Gestion DEBERA rechazar con HTTP 403 y registrar el intento.
4. CUANDO un usuario con Rol_Contraparte consulta tramites, EL Backend_Gestion DEBERA retornar unicamente los que tienen al menos una Solicitud_Insumo activa dirigida a su Departamento.
5. SI un usuario con Rol_Contraparte envia un Insumo para una solicitud de otro Departamento, ENTONCES EL Backend_Gestion DEBERA rechazar con HTTP 403.
6. EL Backend_Gestion DEBERA aplicar las atribuciones mediante RLS en Supabase ademas de validacion en aplicacion.

### Requerimiento 2: Perfil de funcionario y estructura organizacional

**Historia de usuario:** Como analista SIAC, quiero identificar el area y la unidad del funcionario al solicitar un insumo, para saber a que estructura pertenece cada responsable.

#### Criterios de Aceptacion

1. EL Catalogo_Interno DEBERA almacenar para cada contraparte: nombre, correo institucional, Departamento, Unidad y estado activo.
2. CUANDO un usuario con Rol_SIAC crea una Solicitud_Insumo, EL Backend_Gestion DEBERA persistir el Departamento y Unidad vigentes del destinatario.
3. EL Catalogo_Interno DEBERA asociar cada Departamento a exactamente una Unidad.
4. SI el correo del funcionario esta ausente al crear una solicitud, ENTONCES EL Backend_Gestion DEBERA rechazar indicando perfil incompleto.

### Requerimiento 3: Catalogo mantenible de etiquetas internas

**Historia de usuario:** Como administrador SIAC, quiero mantener las tematicas y departamentos desde la app, para no depender de un desarrollador.

#### Criterios de Aceptacion

1. EL Catalogo_Interno DEBERA almacenar tematicas, subtematicas, departamentos, unidades y tipos de requirente en tablas de BD.
2. CUANDO Rol_Admin crea un valor, DEBERA estar disponible para clasificacion de inmediato.
3. CUANDO Rol_Admin desactiva un valor, DEBERA excluirse de selectores y conservarse en tramites ya clasificados.
4. EL Catalogo_Interno DEBERA permitir asociar cada tematica a un Departamento y una Unidad.
5. EL Catalogo_Interno DEBERA inicializarse con los valores del Anexo A.
6. SI un usuario sin Rol_Admin intenta modificar el catalogo, ENTONCES rechazar con HTTP 403.
7. CUANDO Rol_SIAC clasifica un tramite, DEBERA persistir tematica, subtematica, Departamento responsable y tipo de requirente.

### Requerimiento 4: Calculo de plazos legales en dias habiles

**Historia de usuario:** Como analista SIAC, quiero que el plazo de cada tramite se calcule en dias habiles segun su tipo, para alertar con precision normativa.

#### Criterios de Aceptacion

1. EL Motor_Plazos DEBERA interpretar la fecha de ingreso de SIMPLE (timestamp naive sin offset) como hora oficial de Chile continental con DST, cambio de dia a las 00:00.
2. EL Motor_Plazos DEBERA contar desde el primer Dia_Habil posterior a la recepcion como dia uno, incluso si la recepcion cae en fin de semana o feriado.
3. EL Motor_Plazos DEBERA excluir sabados, domingos y feriados nacionales o regionales de Valparaiso. Feriados de jornada parcial cuentan como Dia_Habil.
4. EL Motor_Plazos DEBERA obtener feriados de una tabla con fecha, alcance territorial, jornada completa/parcial y confirmacion de carga por anio.
5. EL Motor_Plazos DEBERA determinar el Plazo_Legal desde una tabla administrable por Rol_Admin (enteros 1-60, uno marcado predeterminado).
6. SI el tipo de solicitud no tiene Plazo_Legal configurado, ENTONCES aplicar el predeterminado y registrar advertencia.
7. SI el anio de la fecha de vencimiento no tiene feriados confirmados, ENTONCES calcular excluyendo solo fines de semana + feriados registrados, marcar provisoria y alertar.
8. EL Motor_Plazos DEBERA exponer dias habiles restantes como entero con signo (positivo=vigente, cero=hoy, negativo=vencido).
9. MIENTRAS un tramite esta abierto y no suspendido, cada recalculo DEBERA producir un valor menor o igual al anterior (monotonicidad), e igual si las entradas no cambiaron (determinismo).
10. SI la fecha de vencimiento cae en dia no habil, DEBERA desplazarse al siguiente Dia_Habil y registrar el desplazamiento.
11. EL Motor_Plazos DEBERA recalcular todos los tramites abiertos al menos una vez por dia, maximo 24h entre ejecuciones exitosas.
12. SI un recalculo falla, ENTONCES conservar valores anteriores, reintentar hasta 3 veces con intervalos crecientes y registrar el fallo.

**Nota:** el valor numerico del Plazo_Legal por tipo es Pregunta Abierta P-1, configurado como dato.

### Requerimiento 5: Suspension y reanudacion de plazos

**Historia de usuario:** Como analista SIAC, quiero registrar cuando un tramite esta suspendido por subsanacion (hecha en SIMPLE), para que el vencimiento descuente ese tiempo.

#### Criterios de Aceptacion

1. CUANDO Rol_SIAC registra una suspension, EL Backend_Gestion DEBERA persistir fecha, motivo y usuario.
2. MIENTRAS el plazo esta suspendido, EL Motor_Plazos DEBERA detener el conteo de dias habiles.
3. CUANDO Rol_SIAC registra la reanudacion, EL Motor_Plazos DEBERA recalcular la fecha de vencimiento sumando los Dia_Habil suspendidos.
4. EL Backend_Gestion DEBERA registrar cada suspension y reanudacion en el Registro_Auditoria.
5. SI Rol_SIAC intenta crear una Solicitud_Insumo en un tramite suspendido, ENTONCES advertir y solicitar confirmacion.
### Requerimiento 6: Rastreador de insumos en paralelo

**Historia de usuario:** Como analista SIAC, quiero abrir multiples solicitudes de insumo a distintas areas en paralelo, para no perder el rastro de quien respondio y quien no.

#### Criterios de Aceptacion

1. CUANDO Rol_SIAC crea una Solicitud_Insumo, EL Backend_Gestion DEBERA persistir: tramite, funcionario, Departamento, Unidad, fecha, instruccion, plazo interno y CC opcional.
2. EL Backend_Gestion DEBERA permitir mas de una Solicitud_Insumo activa por tramite simultaneamente.
3. EL Backend_Gestion DEBERA exponer el progreso: X de Y insumos recibidos (Y=solicitudes activas, X=las que tienen Insumo).
4. CUANDO Rol_SIAC reasigna una solicitud, DEBERA cerrar la anterior con motivo y crear una nueva, notificando a ambos funcionarios.
5. CUANDO Rol_SIAC cancela una solicitud, DEBERA marcarla como cancelada sin eliminarla y actualizar el progreso.
6. CUANDO Rol_SIAC solicita informacion adicional sobre una solicitud existente, DEBERA persistir la solicitud adicional y notificar al destinatario.
7. EL plazo interno de cada solicitud DEBERA ser menor o igual al Plazo_Legal restante del tramite al momento de crearla.
8. DONDE el usuario indica CC, EL Servicio_Notificaciones DEBERA incluirlo en la notificacion.
9. EL Backend_Gestion DEBERA registrar cada operacion en el Registro_Auditoria.

### Requerimiento 7: Registro de insumo recibido

**Historia de usuario:** Como contraparte interna, quiero enviar mi respuesta (texto y adjuntos) desde la app, para que el analista la tenga sin buscar en su correo.

#### Criterios de Aceptacion

1. CUANDO Rol_Contraparte envia un Insumo, EL Backend_Gestion DEBERA persistir texto, adjuntos, autor, fecha y Solicitud_Insumo asociada.
2. CUANDO un Insumo se registra, EL Backend_Gestion DEBERA actualizar el estado de la solicitud a recibido y el progreso del tramite.
3. CUANDO un Insumo se registra, EL Servicio_Notificaciones DEBERA notificar al analista SIAC del tramite.
4. EL Backend_Gestion DEBERA calcular el tiempo de respuesta como Dia_Habil entre fecha ingreso y fecha en que el tramite se marca respondido, descontando suspensiones.

### Requerimiento 8: Alertas configurables de vencimiento

**Historia de usuario:** Como jefatura, quiero alertas antes y despues del vencimiento de cada insumo y tramite, para intervenir a tiempo.

#### Criterios de Aceptacion

1. CUANDO una Solicitud_Insumo alcanza 2 Dia_Habil antes de su plazo interno, EL Servicio_Notificaciones DEBERA enviar alerta de vencimiento proximo.
2. CUANDO una Solicitud_Insumo supera su plazo interno, EL Servicio_Notificaciones DEBERA enviar alerta de plazo superado.
3. CUANDO un tramite alcanza 2 Dia_Habil antes de su fecha de vencimiento, EL Servicio_Notificaciones DEBERA enviar alerta a nivel de tramite.
4. EL Servicio_Notificaciones DEBERA enviar maximo una alerta por tipo, por Solicitud_Insumo/tramite y por regla.
5. CUANDO Rol_SIAC solicita reenviar una alerta, DEBERA enviarla y registrar el reenvio.
6. EL Servicio_Notificaciones DEBERA omitir alertas para tramites respondidos o cerrados.
7. EL Servicio_Notificaciones DEBERA no duplicar notificaciones que SIMPLE ya emite.

### Requerimiento 9: Configuracion de destinatarios y reglas de notificacion

**Historia de usuario:** Como administrador SIAC, quiero decidir quien recibe cada alerta y con que anticipacion, sin cambiar codigo.

#### Criterios de Aceptacion

1. EL Servicio_Notificaciones DEBERA obtener destinatarios y anticipacion desde una tabla de configuracion en BD.
2. Destinatarios admitidos: funcionario de la solicitud, analista SIAC del tramite, jefatura del Departamento, correos explicitos.
3. EL Servicio_Notificaciones DEBERA admitir CC.
4. CUANDO Rol_Admin modifica una regla, DEBERA aplicarse en la siguiente evaluacion sin deploy.
5. EL Servicio_Notificaciones DEBERA permitir configurar la anticipacion en Dia_Habil por regla.
6. EL Servicio_Notificaciones DEBERA permitir activar/desactivar cada regla.
7. SI un usuario sin Rol_Admin intenta modificar una regla, ENTONCES rechazar con HTTP 403.

### Requerimiento 10: Ingesta por eventos desde SIMPLE

**Historia de usuario:** Como sistema, quiero recibir un aviso de SIMPLE en tiempo real cuando un tramite cambia de etapa, para no depender de consultar cada 10 minutos.

#### Criterios de Aceptacion

1. EL Sincronizador_SIMPLE DEBERA exponer un endpoint HTTP POST que SIMPLE invocara mediante tarea externa en cada transicion de tarea.
2. EL endpoint DEBERA autenticar al llamador mediante API_KEY validada contra un secreto almacenado como variable de entorno.
3. CUANDO recibe un evento valido, EL Sincronizador_SIMPLE DEBERA identificar el tramite, consultar su detalle desde la API de SIMPLE, y actualizar solo columnas autoritativas.
4. EL endpoint DEBERA ser idempotente: el mismo evento procesado N veces produce el mismo estado.
5. EL endpoint DEBERA tolerar eventos fuera de orden: un evento de etapa anterior no revierte una etapa posterior ya registrada.
6. EL Sincronizador_SIMPLE DEBERA ejecutar una Reconciliacion diaria que compare todos los tramites activos de SIMPLE con Supabase y repare diferencias.
7. EL cron existente de 10 minutos DEBERA cambiar a ejecucion diaria una vez configurados los eventos. (Hoy: ~26 llamadas/ciclo x 144 ciclos = ~3.700 llamadas/dia para 4 registros reales.)
8. SI el endpoint recibe una solicitud sin API_KEY valida, ENTONCES responder HTTP 401 sin ejecutar nada.

### Requerimiento 11: Preservacion de datos de gestion frente a ingesta

**Historia de usuario:** Como analista SIAC, quiero que mis clasificaciones y solicitudes de insumo sobrevivan a cada ingesta automatica.

#### Criterios de Aceptacion

1. EL Backend_Gestion DEBERA almacenar datos de gestion en tablas/columnas distintas de las que escribe la ingesta. Columnas prohibidas para gestion: area_derivada, funcionario_asignado, prioridad, respuesta, fecha_vencimiento, estado_funcional, dias_restantes.
2. Columnas autoritativas de SIMPLE (las unicas que la ingesta puede escribir): folio, folio_simple, fecha_ingreso, fecha_vencimiento, etapa_actual_id, etapa_actual_nombre, tipo_solicitud, motivo, submotivo, area_derivada, solicitante_nombre, solicitante_rut, solicitante_email, descripcion, respuesta, funcionario_asignado, prioridad, sync_at, raw_data.
3. CUANDO la ingesta modifica un campo autoritativo observable, EL Registro_Auditoria DEBERA registrar un registro por columna con valor anterior, nuevo, timestamp y origen automatico.
4. EL Backend_Gestion DEBERA mantener el estado de gestion en una columna propia distinta de estado_funcional, que cambie solo por accion de usuario o Motor_Plazos.
5. Dos ciclos consecutivos sin cambios en SIMPLE DEBERAN producir valores identicos excepto sync_at, updated_at, dias_restantes, estado_funcional, y cero registros de auditoria del segundo.
6. SI un tramite almacenado no aparece en SIMPLE, ENTONCES conservar la fila, marcar ultimo avistamiento y registrar la ausencia una sola vez.
7. MIENTRAS la ingesta corre, cada accion de gestion DEBERA persistir completamente o fallar completamente (maximo 5s de espera por lock).
8. EL Sincronizador_SIMPLE DEBERA impedir ejecuciones solapadas, registrar omisiones y liberar control al termino o a los 30 minutos.

### Requerimiento 12: Tablero, reporteria y exportacion

**Historia de usuario:** Como jefatura, quiero un tablero con los casos pendientes y los insumos sin responder, para dirigir la operacion con datos actualizados.

#### Criterios de Aceptacion

1. EL Modulo_Reporteria DEBERA exponer una vista de tramites pendientes con folio, tipo, tematica, Departamento, funcionario, vencimiento y dias habiles restantes.
2. EL Modulo_Reporteria DEBERA exponer una vista de tramites con plazo superado, ordenada por dias de atraso.
3. EL Modulo_Reporteria DEBERA mostrar por tramite el progreso de insumos (X/Y) y las solicitudes vencidas.
4. EL Modulo_Reporteria DEBERA exponer reportes por Departamento, tematica, estado y tiempo de respuesta promedio.
5. CUANDO el usuario exporta, DEBERA generar un CSV UTF-8 con BOM con solo los tramites del filtro aplicado.
6. EL Modulo_Reporteria DEBERA omitir datos personales del solicitante para Rol_Contraparte.
7. CUANDO se aplican filtros combinados, DEBERA retornar solo los tramites que cumplen todas las condiciones.

### Requerimiento 13: Registro de auditoria y autenticacion

**Historia de usuario:** Como jefatura, quiero un registro completo de acciones y que todo endpoint este protegido, para responder auditorias.

#### Criterios de Aceptacion

1. CUANDO el Backend_Gestion ejecuta una accion, EL Registro_Auditoria DEBERA persistir: tramite, tipo, usuario, fecha con zona horaria, valor anterior y nuevo.
2. EL Registro_Auditoria DEBERA distinguir acciones de ingesta automatica (sin usuario) de acciones de usuario.
3. EL Registro_Auditoria DEBERA ser inmutable desde la aplicacion.
4. EL Backend_Gestion DEBERA exigir token de sesion Supabase valido en cada endpoint de gestion. Sin token -> HTTP 401.
5. EL Backend_Gestion DEBERA verificar el rol en el servidor antes de cada operacion.
6. EL endpoint de ingesta por eventos DEBERA exigir API_KEY (no sesion de usuario).
7. EL Backend_Gestion DEBERA obtener el token de SIMPLE desde variable de entorno del servidor, sin exponerlo al navegador.
## Fuera de alcance y postergado

| Funcionalidad | Motivo |
|---|---|
| Biblioteca de respuestas tipo | SIMPLE la esta incorporando nativamente |
| Certificado de respuesta | SIMPLE tiene Generar Documento |
| Portal de seguimiento ciudadano | SIMPLE cubre los casos con ClaveUnica |
| Notificacion de ingreso con plazo legal | SIMPLE ya envia correo al ciudadano al ingresar |
| Avance de etapa desde esta app | El usuario opera el flujo directamente en SIMPLE |
| Encuesta de satisfaccion | Postergada - alcance por definir (migracion desde Typeform) |

## Anexo A: Datos semilla del Catalogo_Interno

### A.1 Unidades (6)

GABINETE, UGDP, UATP, UAF, UGVT, UPyCG.

### A.2 Departamentos (22)

Depto. de Juridica, Depto. de Auditoria, Secretaria de Direccion, Depto. de Gabinete, Depto. de Comunicaciones, Depto. de Remuneraciones, Depto. de Procesos Administrativos, Depto. de Formacion y Desarrollo Organizacional, Depto. de Bienestar, Depto. de Mejora Continua y Acompaniamiento TP, Depto. de Monitoreo y Seguimiento de Resultados Educativos, Depto. de Finanzas y Contabilidad, Depto. de Informatica, Depto. de Compras y Logistica, Depto. de Mantencion y Gestion de Proyectos, Depto. de Servicios Generales, Depto. de Atencion y Participacion Ciudadana, Depto. de Gestion Territorial, Depto. de Infraestructura y Equipamiento, Depto. de Presupuesto, Depto. de Planificacion y Control de Gestion, Depto. de Convivencia Escolar.

La asignacion de cada Departamento a su Unidad es materia de la Pregunta Abierta P-5.

### A.3 Tematicas (59)

Declaracion sumario, Otros (Staff Juridico), Garantia licitacion, Correo electronico, Recepcion trabajos contratistas, Recepcion insumos, Habilitacion docente, Traslados y reemplazos, Destinaciones y horarios, Evaluacion docente, Permisos sin goce de remuneraciones, Programa de Integracion Escolar (PIE), Convivencia Escolar, Beneficio sala cuna, Bono compensatorio (Maternidad), Jubilacion, Solicitud MALS, Sumarios MALS, Reclutamiento y Seleccion, Practica profesional, Certificados (72 hrs.), Licencias Medicas, Carga Familiar, Incentivo al retiro, Carrera Docente (Haberes), Contrato de Trabajo, Liquidacion de sueldo, Entrega de Cheques, Problemas de remuneraciones, Pago de Asignaciones Docentes, Pago de Asignaciones Asistente, Cuenta bancaria, Exencion de cotizacion, Cotizaciones previsionales, Deuda previsional, Solicitud de Acceso a la Informacion, Formulario de Atencion Ciudadana, Oficina de Partes, Junaeb, Gestora territorial (Ed. Parvularia y Centros Educativos), Gestora territorial (Ed. Basica), Gestora territorial (Ed. Media), Intervencion proyecto, Antecedentes tecnicos proyectos, Antecedentes aprobatorios, Necesidades de infraestructura, Cita, Certificado alumno regular, Ley de Lobby, Contacto, Finiquito, Matricula, Reclamo, Uniforme, Sin etiqueta, Felicitaciones, Intranet, Informacion General, Denuncia.

Observaciones:
- Convivencia Escolar figura como tematica y como Departamento. El Catalogo_Interno los mantiene como registros de tablas distintas.
- Reclamo y Denuncia son tematicas y tambien determinan el Plazo_Legal segun R4.
- Sin etiqueta es el valor predeterminado para tramites no clasificados.

### A.4 Etapas SIMPLE conocidas

| ID tarea | Nombre | Confirmacion |
|---|---|---|
| 54 | 1. Ingreso de Solicitud | Confirmada |
| 55 | 2. Revision de Requerimiento | Confirmada |
| 56 | 3. Derivacion de solicitud | Supuesta |
| 57 | 4. Revision Final Oficina de Partes | Supuesta |

## Anexo B: Propiedades de correctitud candidatas

1. **Idempotencia de la ingesta** (R11.5): dos ciclos sin cambios en SIMPLE producen el mismo estado y cero registros de auditoria del segundo.
2. **Invariante de preservacion de gestion** (R11.1, R11.7): campos de gestion antes y despues de un ciclo de ingesta son iguales.
3. **Ida y vuelta del CSV** (R12.5): parsear(exportarCSV(conjunto)) produce los mismos valores que conjunto.
4. **Invariante de plazos** (R4.2, R4.10): la fecha de vencimiento es un Dia_Habil y es posterior o igual a la fecha de ingreso.
5. **Metamorfica de plazos** (R4.3): Dia_Habil entre dos fechas es menor o igual a dias corridos entre las mismas.
6. **Monotonicidad** (R4.9): mientras el plazo corre y las entradas no cambian, dias restantes nunca aumenta.
7. **Idempotencia de alertas** (R8.4): evaluar reglas N veces el mismo dia no genera envios adicionales.
8. **Invariante de autorizacion** (R1.3): para todo usuario sin Rol_SIAC, ninguna secuencia crea una Solicitud_Insumo.
9. **Consistencia del progreso** (R6.3): insumos recibidos nunca excede solicitudes activas, y el progreso es independiente del orden de respuesta.

Las integraciones con SIMPLE, correo y Supabase se cubren con 1-3 pruebas de integracion, no con pruebas basadas en propiedades.

## Preguntas Abiertas

| ID | Pregunta | Contexto | Impacto |
|---|---|---|---|
| **P-1** | Plazo_Legal exacto por tipo de solicitud | Correo area: 5 dias habiles solicitudes, 10 reclamos. Respuesta usuario: 20 solicitudes, 10 reclamos. Codigo actual: 21 dias corridos. | Alertas y reportes incorrectos. |
| **P-2** | ~~SIMPLE write-back~~ | RETIRADA. El avance de etapa salio del alcance. | - |
| **P-3** | Alcance encuesta de satisfaccion | Postergada. Sin definir preguntas, escala ni momento. | No implementable. |
| **P-4** | Duenio operacional del catalogo y reglas | Rol_Admin definido sin personas asignadas. | Se degradan sin duenio. |
| **P-5** | Asignacion Departamento a Unidad | 22 deptos y 6 unidades sin relacion definida. | Reportes por Unidad no calculables. |
| **P-6** | Fuente de feriados legales chilenos | Carga manual, API publica o archivo semilla? | Calculo se degrada en meses con feriados. |
| **P-7** | Servicio de correo para alertas internas | Solo alertas internas. SIMPLE tiene Enviar Correo que podria cubrir parte. | Alertas inoperativas. |
| **P-8** | Datos personales del solicitante visibles a contrapartes | R12.6 restringe pero sin politica institucional. | Riesgo exposicion. |
| **P-9** | El campo Mensaje de tarea externa puede interpolar el ID del tramite? | Critico: el evento debe identificar que tramite disparo la llamada. | R10 no implementable, se mantiene polling. |
| **P-10** | En que momento del ciclo de vida de una tarea se dispara la llamada externa? | Al entrar, al salir, al completar? | Riesgo de procesar datos parciales. |
| **P-11** | Es valido que un tramite desaparezca del resultado de SIMPLE? | El sync descarta tramites sin datos y la paginacion puede ser incompleta. | Falsos positivos de tramite ausente. |