# Perletta

Armario personal y maletas en el navegador. Se instala como app (PWA) y guarda todo en Supabase.

[mi-armario-sooty.vercel.app](https://mi-armario-sooty.vercel.app)

![Armario en escritorio](docs/armario.png)

<img src="docs/movil.png" alt="Armario en el móvil" width="260">

En `docs/diseno/` están las demás vistas, en móvil y escritorio, claro y oscuro.

## Qué hace

- Añadir prendas con la foto recortada en el dispositivo. La primera vez que se usa el recorte se descarga el modelo (unos 24 MB, 6 MB comprimidos).
- Organizar la ropa por tipo y categoría, buscar y filtrar.
- Tres secciones: **Armario**, **Maletas** y **Semana**.
- Montar outfits arrastrando las prendas. En el lienzo hay un maniquí: al soltar una camiseta sobre el cuerpo se imanta al torso, un pantalón a las piernas y unos zapatos a los pies. También se pueden dejar sueltas al lado.
- En **Maletas**, lista de equipaje con casillas, clima del destino para las fechas del viaje y descarga del outfit como imagen.
- En **Semana**, elegir un día en el calendario y crear la semana completa (lunes a domingo), con un outfit por día.
- Marcar «Me lo he puesto» en una prenda y ver la última fecha de uso.
- **Etiquetado automático**: al elegir la foto, la app calcula los colores en el móvil y una IA propone nombre, tipo, categoría, temporada, abrigo, formalidad, largo y estampado. Tú confirmas o corriges. En Ajustes, «Etiquetar mi armario» hace lo mismo con las prendas que ya tenías.
- **¿Qué me pongo hoy?** (en Armario y en Semana): con el tiempo de hoy, lo que más tiempo llevas sin ponerte y la armonía de color, propone 3 outfits vestidos en el maniquí. «Otra» cambia uno, tocar una prenda la fija, y «Me lo pongo» lo deja como outfit de hoy en la Semana y anota el uso.
- **Maleta inteligente**: «Prepárala por mí» consulta el tiempo del destino día a día (previsión hasta 15 días; más allá, la media del año pasado) y monta un outfit distinto por día con las menos prendas posibles, con un máximo de pares de zapatos y un plan por día (ciudad, playa, cena, montaña). Se guarda como outfits normales y añade a la lista lo que no es ropa. La lista de la maleta vive en Supabase.
- **Registro de uso sin esfuerzo**: al abrir la app, si un outfit planificado de esta semana no tiene uso anotado, pregunta «¿Te pusiste «…» ayer?» (Sí / No / Cambié algo).
- **Mi armario en números** (en Ajustes): lo que más y menos te pones, coste por uso, mejores y peores compras, reparto por color, tipo y temporada, y lo que lleva 90 días sin usarse, con acciones para archivar, marcar para donar o vender, o pedir un outfit con esa prenda. Las archivadas se ocultan de la galería y de las propuestas pero conservan su historial.
- **Compartir**: cada outfit y cada maleta se comparten como imagen con el menú del móvil (o se descargan si no se puede). La de la maleta es un resumen con todos sus outfits en cuadrícula y las fechas.
- **Subida masiva**: elige varias fotos a la vez; se preparan una a una en segundo plano (recorte, colores, IA) mientras sigues usando la app, y las revisas en una lista antes de guardarlas.
- **Maniquí**: pellizca una prenda puesta para agrandarla o encogerla hasta un 20 % (doble toque la restablece) y mete la camiseta por dentro del pantalón con el botón de la prenda.
- **Lista de deseos** («Quiero», en Armario): prendas que aún no tienes, con foto (subida o pegada) y precio. Cada una dice con cuántas de tus prendas combina y enseña cómo quedaría en outfits con lo que ya tienes. «Ya lo tengo» la pasa al armario.
- **Sin conexión**: las fotos ya vistas se abren sin red (en el avión) y lo que anotes sin conexión (usos, la lista de la maleta) se guarda en el móvil y se envía solo al volver la red. Un aviso indica «Sin conexión» y cuántos cambios esperan.
- Filtros en el armario por color, temporada, formalidad y «sin usar en 90 días».
- El largo de cada prenda (crop, cadera, bermuda, midi…) decide cómo cae en el maniquí.
- Cambiar la foto al editar una prenda.
- Copia de seguridad en JSON, con restauración desde Ajustes.
- Recuperar la contraseña por correo.
- Tema claro y oscuro.

## Stack

React 19, Vite 8, Tailwind CSS 4, Supabase (Postgres y Storage) y vite-plugin-pwa.

## Arrancar

Copia `.env.example` a `.env` y rellena las dos variables:

```
cp .env.example .env
npm install
npm run dev
```

## Base de datos

En un proyecto nuevo, ejecuta `supabase/esquema.sql` en el **SQL Editor**. Crea las tablas, las políticas y el bucket privado.

Si el proyecto ya tenía datos, ejecuta en este orden:

1. `supabase/multiusuario.sql`: añade `user_id`, pone las políticas por dueño y limita el bucket a la carpeta de cada cuenta.
2. `supabase/actualizacion-v3.sql`: añade semanas, la columna `ranura` del maniquí, la tabla `usos`, el destino y las fechas de la maleta, las cascadas y el bucket privado.

3. `supabase/actualizacion-v4.sql`: añade a las prendas colores, temporada, abrigo, formalidad, largo, estampado, precio, el origen de las etiquetas y `archivada`, la columna `salida` (donar o vender), la escala y «por dentro» de cada prenda del maniquí, la columna `deseada` (lista de deseos) y la tabla `maleta_extras` (lista de la maleta). Si falta, la app sigue funcionando: la lista se guarda solo en el móvil.
4. `supabase/actualizacion-v5.sql`: deja un solo uso por prenda y día, añade la cuota diaria de las funciones de pago (`consumir_cuota`), las valoraciones y las suscripciones a avisos push. Va en una transacción: se aplica entera o no se aplica.

Ejecuta el SQL antes de desplegar la versión nueva. La app aguanta sin algunas columnas (por ejemplo, guarda la posición aunque no exista `ranura`), pero la sección Semana necesita su tabla.

En **Authentication → Providers → Email**, deja activo el proveedor y desactiva **Confirm email**. Así una cuenta recién creada puede entrar sin servidor de correo. Para que «¿Olvidaste la contraseña?» llegue a cualquiera en producción, configura un SMTP propio en Supabase (Resend, Brevo, etc.): el correo integrado tiene un límite muy bajo.

Con el registro abierto, cualquiera puede crear una cuenta en tu proyecto. Si la app es solo tuya, desactiva el registro de nuevos usuarios en **Authentication** (en **Providers → Email**, «Allow new users to sign up»).

En **Authentication → URL Configuration**, añade la URL de la app y `http://localhost:5173` a las Redirect URLs. Sin eso, el enlace de recuperación no vuelve a Perletta.

Rota la clave pública en **Settings → API Keys** y usa la nueva en `VITE_SUPABASE_ANON_KEY`. El `.env` viejo sigue en el historial de Git; rotar la clave es lo que lo inutiliza.

Las cuentas nuevas empiezan vacías: cada una crea sus tipos y categorías en **Ajustes → Tipos / Categorías**.

## Etiquetado automático (IA)

Los colores salen de la foto en el propio móvil, sin coste ni red. El resto (tipo, largo, temporada, abrigo, formalidad…) lo propone Claude mirando la foto, desde una Edge Function de Supabase: la clave de la API nunca llega al navegador. Sin la función desplegada, todo lo demás funciona igual y solo falta la sugerencia.

1. Crea una clave en la consola de Anthropic (console.anthropic.com → API Keys).
2. Instala la CLI de Supabase y enlaza el proyecto:
   ```
   npm i -g supabase
   supabase login
   supabase link --project-ref <tu-referencia>
   ```
   La referencia está en la URL del panel de Supabase, o en **Settings → General**.
3. Guarda la clave como secreto y despliega la función:
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy etiquetar-prenda
   ```
4. Opcional: `supabase secrets set MODELO_ETIQUETADO=claude-haiku-5-5` usa un modelo más barato y rápido (por defecto, `claude-sonnet-5-5`).

La función exige sesión iniciada, solo lee fotos de la carpeta del propio usuario y rechaza imágenes de más de 1,5 MB.

## Leer enlaces de tiendas

La lista de deseos puede rellenar nombre, precio y foto pegando el enlace de una tienda. Esa lectura la hace otra Edge Function, `leer-enlace`, que descarga la página con filtros contra SSRF. Despliégala con:

```
supabase functions deploy leer-enlace
```

No necesita secretos. Exige sesión iniciada y comparte la cuota diaria de `consumir_cuota` (50 lecturas al día por cuenta; 100 para el etiquetado con IA).

## Aviso por la mañana (Web Push)

Una Edge Function llamada cada hora envía, a la hora local que elija cada cuenta, una propuesta con una prenda de arriba y otra de abajo (o un vestido). Si hay coordenadas mira el tiempo con Open-Meteo; si no, propone sin tiempo. Las prendas archivadas o deseadas no entran, y cada consulta filtra siempre por el `user_id` de la suscripción.

La tabla `avisos_push` ya la crea `supabase/actualizacion-v5.sql`. La interfaz de Ajustes usa `src/lib/push.js` (`soportado`, `estado`, `activar` y `desactivar`); la lógica de la propuesta está en `supabase/functions/aviso-diario/seleccion.js`.

1. Genera el par de claves VAPID (no hace falta añadir nada a `package.json`):
   ```
   npx web-push generate-vapid-keys
   ```
   Guarda la **pública** y la **privada**. La privada no va nunca al navegador.

2. En Vercel, añade `VITE_VAPID_PUBLICA` con la clave pública y vuelve a desplegar. Sin esa variable la app no ofrece activar los avisos:
   ```
   VITE_VAPID_PUBLICA=<clave-publica-vapid>
   ```

3. Guarda los secretos de la función en Supabase (usa un correo o URL de contacto real):
   ```
   supabase secrets set \
     CRON_SECRETO=<cadena-larga-y-aleatoria> \
     VAPID_PUBLICA=<clave-publica-vapid> \
     VAPID_PRIVADA=<clave-privada-vapid> \
     VAPID_CONTACTO=mailto:tu@correo.com
   ```

4. Despliega sin verificación de JWT: la autenticación es la cabecera `x-cron-secreto`, que se compara en tiempo constante. Sin `CRON_SECRETO` configurado la función responde cerrada.
   ```
   supabase functions deploy aviso-diario --no-verify-jwt
   ```

5. Programa la llamada cada hora con `pg_cron` y `pg_net`. En el **SQL Editor**, sustituye `<REFERENCIA>` (la de tu proyecto) y `<CRON_SECRETO>` (el mismo del paso 3):
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select vault.create_secret('<CRON_SECRETO>', 'cron_secreto', 'Cabecera del cron de aviso-diario');

   select cron.schedule(
     'aviso-diario-cada-hora',
     '0 * * * *',
     $$
     select net.http_post(
       url := 'https://<REFERENCIA>.supabase.co/functions/v1/aviso-diario',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secreto', (
           select decrypted_secret from vault.decrypted_secrets where name = 'cron_secreto'
         )
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     );
     $$
   );
   ```
   Para cambiar la hora o quitarlo:
   ```sql
   select cron.unschedule('aviso-diario-cada-hora');
   ```

En iPhone y iPad los avisos solo funcionan con la app añadida a la pantalla de inicio; `estado()` de `src/lib/push.js` devuelve el mensaje para explicarlo. Si el permiso está denegado, también indica cómo volver a activarlo en los ajustes del navegador. El service worker abre `/?vista=hoy` al tocar la notificación.

La función valida que el endpoint sea `https` y de un servicio push conocido (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com` o `*.notify.windows.com`) antes de enviar. Marca `ultimo_envio` de forma atómica antes del envío para no duplicar el aviso, y borra las suscripciones que el servicio responde con 404 o 410.

## Comprobar

```
npm test        # fechas, nombres, maniquí, copias y lógica de outfits
npm run lint
npm run build
```

GitHub Actions ejecuta lo mismo en cada push y en cada pull request (`.github/workflows/ci.yml`).

## Estructura

```
src/App.jsx                 navegación, modales y puerta de acceso
src/components/             armario, maletas, semanas, maniquí, formularios y gestores
src/lib/                    fechas, maniquí, imágenes firmadas, copias, caché y outfits
src/lib/imagenes.js         URLs firmadas del bucket privado, con caché en memoria y disco
src/lib/colores.js          colores dominantes de una foto (OKLab) y familia de color
src/lib/etiquetas.js        etiquetas de las prendas: validación y llamadas a Supabase
src/lib/vestir.js           cómo cae cada prenda sobre el maniquí
src/lib/sugerir.js          propuestas de outfit (clima, rotación, color, formalidad)
src/lib/clima.js            tiempo de hoy y previsión de un viaje con Open-Meteo
src/lib/push.js             activar y desactivar los avisos push del móvil
public/push-sw.js           eventos push y notificationclick del service worker
src/lib/capsula.js          maleta mínima: un outfit distinto por día con las menos prendas
src/lib/checklistMaleta.js  lista de la maleta en la base de datos
src/lib/cargaMasiva.js      cola de subida masiva de fotos
src/lib/estadoPrenda.js     escala, «por dentro» y guardado del estado de cada prenda en el maniquí
src/lib/deseos.js           cuánto combina un deseo con tu armario
src/lib/colaOffline.js      acciones sin conexión que se envían al volver la red
src/lib/uso.js              qué outfits planificados faltan por anotar como puestos
src/lib/estadisticas.js     «Mi armario en números»
supabase/esquema.sql        instalación completa desde cero
supabase/actualizacion-v3.sql  migración para proyectos con datos
supabase/actualizacion-v4.sql  etiquetas de las prendas
supabase/actualizacion-v5.sql  cuotas, valoraciones y avisos push
supabase/functions/etiquetar-prenda/  visión con IA (Edge Function)
supabase/functions/leer-enlace/       lectura de enlaces de tiendas (Edge Function)
supabase/functions/aviso-diario/      propuesta del día por Web Push (Edge Function)
supabase/multiusuario.sql   cuentas separadas y políticas por dueño
```

## Licencias

`@imgly/background-removal` se distribuye con licencia **AGPL-3.0**. Si el proyecto se publica como servicio, conviene revisar qué implica o sustituirlo por otro recorte.

## Pendiente

- Tests de interfaz (el flujo de añadir prenda, montar un outfit y crear una semana).
