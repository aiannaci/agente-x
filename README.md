# Agente X

Recordatorios de informes y tareas del trabajo. App web instalable (PWA) para Android y la compu.

## Qué hace (etapa 1)
- Informes con destinatarios (Para / CC), reglas de envío y asunto de email automático.
- Reglas: días de la semana, día fijo del mes, N-ésimo día hábil (o último), N-ésimo día de la semana del mes, una sola vez.
- Si la fecha cae feriado o fin de semana, se adelanta al día hábil anterior.
- Feriados de Argentina editables.
- Tareas con o sin fecha, repetitivas, con prioridad.
- Pantallas: Hoy, Próximos, Informes, Tareas, Historial.
- Mover o saltear un envío puntual sin cambiar la regla.

Los datos se guardan por ahora en el dispositivo. En la etapa 2 se suman login con Google y servidor (Cloudflare) para sincronizar entre celu y compu; en la etapa 3, las notificaciones push.

## Desarrollo
```bash
npm install
npm run dev      # servidor local
npm test         # pruebas de reglas y feriados
npm run build    # build de producción en dist/
```
