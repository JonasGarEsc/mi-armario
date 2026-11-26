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

3. `supabase/actualizacion-v4.sql`: añade a las prendas colores, temporada, abrigo, formalidad, largo, estampado, precio, el origen de las etiquetas y `archivada`.

Ejecuta el SQL antes de desplegar la versión nueva. La app aguanta sin algunas columnas (por ejemplo, guarda la posición aunque no exista `ranura`), pero la sección Semana necesita su tabla.

En **Authentication → Providers → Email**, deja activo el proveedor y desactiva **Confirm email**. Así una cuenta recién creada puede entrar sin servidor de correo. Para que «¿Olvidaste la contraseña?» llegue a cualquiera en producción, configura un SMTP propio en Supabase (Resend, Brevo, etc.): el correo integrado tiene un límite muy bajo.

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
src/lib/clima.js            tiempo de hoy con Open-Meteo
supabase/esquema.sql        instalación completa desde cero
supabase/actualizacion-v3.sql  migración para proyectos con datos
supabase/actualizacion-v4.sql  etiquetas de las prendas
supabase/functions/etiquetar-prenda/  visión con IA (Edge Function)
supabase/multiusuario.sql   cuentas separadas y políticas por dueño
```

## Licencias

`@imgly/background-removal` se distribuye con licencia **AGPL-3.0**. Si el proyecto se publica como servicio, conviene revisar qué implica o sustituirlo por otro recorte.

## Pendiente

- Tests de interfaz (el flujo de añadir prenda, montar un outfit y crear una semana).
