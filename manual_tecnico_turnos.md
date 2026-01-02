# Manual Técnico del Sistema de Turnos

Este documento describe el funcionamiento técnico y los flujos de trabajo del nuevo módulo de turnos implementado en el servidor Vitalmed.

## 1. Roles y Permisos

El sistema distingue dos niveles de acceso principales para estas operaciones:

*   **Administrador / Secretaria**:
    *   Tiene control total sobre la **creación de disponibilidad** (oferta de turnos).
    *   Puede ver todos los turnos de todos los médicos.
    *   Puede cancelar cualquier turno.
*   **Paciente**:
    *   Puede **buscar** turnos disponibles.
    *   Puede **reservar** un turno disponible.
    *   Puede ver **su propio historial** de turnos.
    *   Solo puede interactuar con turnos en estado "disponible" (para reservar) o sus propios turnos.

## 2. Flujos de Trabajo (Paso a Paso)

### A. Gestión de Disponibilidad (Oferta)
**Actor**: Secretaria / Administrador

1.  **Acción**: La secretaria decide qué días y horarios atenderá un médico específico.
2.  **Proceso Técnico**:
    *   Se envía una petición `POST` a `/api/turnos/disponibilidad`.
    *   **Datos requeridos**: `doctorId` y un array de `horarios` (fechas/horas exactas en formato ISO).
3.  **Resultado**: El sistema crea múltiples documentos `Turno` en la base de datos con estado `disponible` y el campo `paciente` vacío.

### B. Búsqueda de Turnos
**Actor**: Paciente / Secretaria

1.  **Acción**: El usuario desea saber qué turnos hay libres.
2.  **Proceso Técnico**:
    *   Se envía una petición `GET` a `/api/turnos`.
    *   **Filtros**: Se pueden pasar parámetros por URL (Query Params) para refinar la búsqueda:
        *   `?especialidad=Cardiologia`: Filtra por especialidad del médico.
        *   `?doctor=ID_DOCTOR`: Filtra por un médico específico.
        *   `?fecha=2023-12-01`: Filtra por un día específico.
        *   `?estado=disponible`: (Por defecto) Muestra solo los libres.
3.  **Resultado**: El servidor devuelve una lista de objetos `Turno` con la información del médico y el horario.

### C. Reserva de Turno
**Actor**: Paciente (o Secretaria a nombre de un paciente)

1.  **Acción**: El paciente elige un horario específico de la lista obtenida en el paso anterior.
2.  **Proceso Técnico**:
    *   Se envía una petición `POST` a `/api/turnos/reservar/{turnoId}`.
    *   **Datos requeridos**: `pacienteId` (ID del paciente que tomará el turno) y `motivoConsulta` (opcional).
    *   **Validación**: El sistema verifica que el turno siga `disponible` (evita doble reserva) y que el paciente exista.
3.  **Resultado**:
    *   El estado del turno cambia a `reservado`.
    *   Se asigna el `pacienteId` al turno.
    *   **Notificación**: El sistema dispara automáticamente el servicio de email para enviar un correo de confirmación al paciente.

### D. Cancelación
**Actor**: Secretaria / Paciente

1.  **Acción**: Se cancela una cita programada.
2.  **Proceso Técnico**:
    *   Se envía una petición `PUT` a `/api/turnos/cancelar/{turnoId}`.
    *   **Datos**: Se puede adjuntar un `motivo` de cancelación.
3.  **Resultado**:
    *   El estado del turno vuelve a ser `disponible`.
    *   El campo `paciente` se vacía, permitiendo que otra persona lo reserve.
    *   Se agrega una nota en los comentarios del turno indicando la cancelación previa.

## 3. Especificaciones del Modelo de Datos

El modelo `Turno` cuenta con los siguientes campos clave para soportar esta lógica:

*   **`estado`**: Controla el ciclo de vida del turno.
    *   `disponible`: Recién creado, listo para tomar.
    *   `reservado`: Asignado a un paciente.
    *   `cancelado`: Dado de baja.
    *   `finalizado`: (Opcional) Para marcar que la atención médica ocurrió.
*   **`especialidad`**: Se guarda una copia de la especialidad del médico al momento de crear el turno, para facilitar búsquedas rápidas sin necesidad de "joins" complejos.

## 4. Integraciones

*   **Servicio de Email**: Integrado en el controlador de reserva. Utiliza `nodemailer` (configuración placeholder lista para SMTP real) para enviar confirmaciones HTML profesionales.
