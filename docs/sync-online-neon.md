# Sincronizacion online con Neon

Netlify debe quedar como visor de la app. La lectura pesada de Dulce Hora conviene hacerla desde el ordenador local, porque el panel externo tarda y consume funciones de Netlify.

## Configuracion local

1. Abrir `.env.local`.
2. Agregar la misma `DATABASE_URL` que usa Netlify para Neon.
3. Mantener `DULCE_HORA_USERNAME` y `DULCE_HORA_PASSWORD`.
4. Iniciar con `iniciar-app-online-neon.bat`.
5. Entrar a `http://127.0.0.1:5173` o a la IP local.
6. Ir a Importaciones y sincronizar historial o el dia actual.

Cuando esta configurado asi, el backend local escribe directamente en Neon. Netlify muestra esos datos sin tener que hacer scraping de Dulce Hora.

## Importante

No subir `.env.local` a GitHub ni a Netlify. Ese archivo queda solo en el ordenador.
