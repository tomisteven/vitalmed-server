# Documentación Frontend - Sistema de Gestión de Turnos

## Descripción General
Sistema de gestión de turnos médicos que permite a secretarias crear disponibilidad horaria y a pacientes reservar citas con médicos según especialidad.

## Roles de Usuario

### 1. Secretaria/Administrador
- Puede crear disponibilidad de turnos para médicos
- Puede ver todos los turnos del sistema
- Puede reservar turnos a nombre de pacientes
- Puede cancelar cualquier turno

### 2. Paciente
- Puede buscar turnos disponibles por especialidad o médico
- Puede reservar turnos disponibles
- Puede ver su historial de turnos
- Puede cancelar sus propios turnos

## API Endpoints

**Base URL**: `http://localhost:3000/api`

### 1. Crear Disponibilidad
**Endpoint**: `POST /turnos/disponibilidad`  
**Rol**: Secretaria/Admin  
**Descripción**: Crea múltiples slots de turnos disponibles para un médico

**Request Body**:
```json
{
  "doctorId": "64abc123...",
  "horarios": [
    "2023-12-01T09:00:00.000Z",
    "2023-12-01T09:30:00.000Z",
    "2023-12-01T10:00:00.000Z"
  ]
}
```

**Response**:
```json
{
  "message": "Disponibilidad creada exitosamente.",
  "turnos": [
    {
      "_id": "64xyz...",
      "fecha": "2023-12-01T09:00:00.000Z",
      "doctor": "64abc123...",
      "especialidad": "Cardiología",
      "estado": "disponible",
      "paciente": null
    }
  ]
}
```

### 2. Buscar Turnos
**Endpoint**: `GET /turnos`  
**Rol**: Todos  
**Descripción**: Busca turnos con filtros opcionales

**Query Parameters**:
- `estado`: "disponible" | "reservado" | "cancelado" | "finalizado"
- `doctorId`: ID del médico
- `especialidad`: Nombre de la especialidad
- `fecha`: Fecha en formato YYYY-MM-DD

**Ejemplos**:
- `/turnos?estado=disponible`
- `/turnos?especialidad=Cardiología&estado=disponible`
- `/turnos?doctorId=64abc123&fecha=2023-12-01`

**Response**:
```json
[
  {
    "_id": "64xyz...",
    "fecha": "2023-12-01T09:00:00.000Z",
    "doctor": {
      "_id": "64abc123...",
      "nombre": "Dr. Juan Pérez",
      "especialidad": "Cardiología"
    },
    "paciente": null,
    "especialidad": "Cardiología",
    "estado": "disponible"
  }
]
```

### 3. Reservar Turno
**Endpoint**: `POST /turnos/reservar/:turnoId`  
**Rol**: Paciente/Secretaria  
**Descripción**: Reserva un turno disponible para un paciente

**Request Body**:
```json
{
  "pacienteId": "64def456...",
  "motivoConsulta": "Control de rutina"
}
```

**Response**:
```json
{
  "message": "Turno reservado exitosamente.",
  "turno": {
    "_id": "64xyz...",
    "fecha": "2023-12-01T09:00:00.000Z",
    "doctor": "64abc123...",
    "paciente": "64def456...",
    "estado": "reservado",
    "motivoConsulta": "Control de rutina"
  }
}
```

**Nota**: Al reservar, se envía automáticamente un email de confirmación al paciente.

### 4. Obtener Mis Turnos
**Endpoint**: `GET /turnos/mis-turnos/:pacienteId`  
**Rol**: Paciente  
**Descripción**: Obtiene todos los turnos de un paciente específico

**Response**:
```json
[
  {
    "_id": "64xyz...",
    "fecha": "2023-12-01T09:00:00.000Z",
    "doctor": {
      "_id": "64abc123...",
      "nombre": "Dr. Juan Pérez",
      "especialidad": "Cardiología"
    },
    "estado": "reservado",
    "motivoConsulta": "Control de rutina"
  }
]
```

### 5. Cancelar Turno
**Endpoint**: `PUT /turnos/cancelar/:turnoId`  
**Rol**: Paciente/Secretaria  
**Descripción**: Cancela un turno. **IMPORTANTE**: El turno vuelve a estar disponible automáticamente.

**Request Body**:
```json
{
  "motivo": "No puedo asistir"
}
```

**Response**:
```json
{
  "message": "Turno cancelado y puesto disponible nuevamente.",
  "turno": {
    "_id": "64xyz...",
    "fecha": "2023-12-01T09:00:00.000Z",
    "estado": "disponible",
    "paciente": null,
    "comentarios": "[Cancelado previa reserva: No puedo asistir]"
  }
}
```

## Componentes Sugeridos

### Para Secretaria/Admin

#### 1. `CrearDisponibilidadForm`
**Propósito**: Formulario para crear slots de turnos  
**Campos**:
- Selector de Doctor (dropdown con lista de doctores)
- Selector de Fecha
- Selector de Hora Inicio
- Selector de Hora Fin
- Intervalo entre turnos (ej: 30 min)
- Botón "Generar Turnos"

**Lógica**:
- Generar array de fechas ISO basado en inicio, fin e intervalo
- Llamar a `POST /turnos/disponibilidad`

#### 2. `ListaTurnosAdmin`
**Propósito**: Ver todos los turnos del sistema  
**Características**:
- Filtros por doctor, especialidad, fecha, estado
- Tabla con columnas: Fecha/Hora, Doctor, Paciente, Estado, Acciones
- Botón "Cancelar" en cada fila
- Indicadores visuales por estado (colores)

**Endpoints**:
- `GET /turnos` con query params para filtros
- `PUT /turnos/cancelar/:id` para cancelar

### Para Pacientes

#### 3. `BuscadorTurnos`
**Propósito**: Buscar turnos disponibles  
**Campos**:
- Selector de Especialidad (dropdown)
- Selector de Doctor (opcional, filtrado por especialidad)
- Selector de Fecha
- Botón "Buscar"

**Lógica**:
- Llamar a `GET /turnos?estado=disponible&especialidad=X&fecha=Y`
- Mostrar resultados en cards o lista

#### 4. `TarjetaTurno`
**Propósito**: Mostrar información de un turno disponible  
**Contenido**:
- Fecha y hora formateada
- Nombre del doctor
- Especialidad
- Botón "Reservar"

**Acción**:
- Al hacer clic en "Reservar", abrir modal con campo "Motivo de consulta"
- Llamar a `POST /turnos/reservar/:id`

#### 5. `MisTurnos`
**Propósito**: Ver historial de turnos del paciente  
**Características**:
- Tabs: "Próximos" y "Pasados"
- Cards con información del turno
- Botón "Cancelar" solo en turnos futuros con estado "reservado"
- Indicador visual del estado

**Endpoints**:
- `GET /turnos/mis-turnos/:pacienteId`
- `PUT /turnos/cancelar/:id`

## Estados del Turno

| Estado | Descripción | Color Sugerido |
|--------|-------------|----------------|
| `disponible` | Turno libre para reservar | Verde |
| `reservado` | Turno asignado a un paciente | Azul |
| `cancelado` | (No se usa - al cancelar vuelve a disponible) | - |
| `finalizado` | Consulta realizada | Gris |

## Flujo de Usuario

### Flujo Secretaria
1. Ingresa a "Gestión de Turnos"
2. Selecciona doctor y define horarios
3. Sistema crea slots disponibles
4. Puede ver en tiempo real las reservas de pacientes

### Flujo Paciente
1. Ingresa a "Reservar Turno"
2. Selecciona especialidad (ej: "Cardiología")
3. Ve lista de turnos disponibles
4. Selecciona un turno y completa motivo de consulta
5. Recibe confirmación por email
6. Puede ver/cancelar desde "Mis Turnos"

## Consideraciones Técnicas

### Manejo de Fechas
- El backend espera fechas en formato ISO 8601 (ej: `2023-12-01T09:00:00.000Z`)
- Usar librerías como `date-fns` o `dayjs` para formatear

### Autenticación
- Los endpoints requieren que el usuario esté autenticado
- Incluir token de autenticación en headers si aplica

### Validaciones Frontend
- Verificar que la fecha seleccionada sea futura
- No permitir reservar turnos en el pasado
- Validar que se complete el motivo de consulta

### Notificaciones
- Mostrar toast/snackbar al reservar exitosamente
- Mostrar confirmación antes de cancelar
- Indicar cuando se envió el email de confirmación

## Ejemplo de Integración

```javascript
// Ejemplo: Reservar un turno
const reservarTurno = async (turnoId, pacienteId, motivoConsulta) => {
  try {
    const response = await fetch(`http://localhost:3000/api/turnos/reservar/${turnoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${token}` // Si usas auth
      },
      body: JSON.stringify({
        pacienteId,
        motivoConsulta
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Mostrar mensaje de éxito
      alert(data.message);
      // Redirigir a "Mis Turnos"
    } else {
      // Mostrar error
      alert(data.message);
    }
  } catch (error) {
    console.error('Error al reservar:', error);
  }
};
```

## Notas Importantes

1. **Cancelación**: Al cancelar un turno, este vuelve automáticamente a estado "disponible" y puede ser reservado por otro paciente.

2. **Email**: El sistema está preparado para enviar emails de confirmación, pero actualmente está en modo simulación. Configurar credenciales SMTP en `.env` para activarlo.

3. **Concurrencia**: El backend valida que un turno esté "disponible" antes de reservar, evitando doble reserva.

4. **Historial**: Los comentarios del turno guardan información sobre cancelaciones previas para auditoría.
