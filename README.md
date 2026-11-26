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

Ejecuta el SQL antes de desplegar la versión nueva. La app aguanta sin algunas columnas (por ejemplo, guarda la posición aunque no exista `ranura`), pero la sección Semana necesita su tabla.

En **Authentication → Providers → Email**, deja activo el proveedor y desactiva **Confirm email**. Así una cuenta recién creada puede entrar sin servidor de correo. Para que «¿Olvidaste la contraseña?» llegue a cualquiera en producción, configura un SMTP propio en Supabase (Resend, Brevo, etc.): el correo integrado tiene un límite muy bajo.

En **Authentication → URL Configuration**, añade la URL de la app y `http://localhost:5173` a las Redirect URLs. Sin eso, el enlace de recuperación no vuelve a Perletta.

Rota la clave pública en **Settings → API Keys** y usa la nueva en `VITE_SUPABASE_ANON_KEY`. El `.env` viejo sigue en el historial de Git; rotar la clave es lo que lo inutiliza.

Las cuentas nuevas empiezan vacías: cada una crea sus tipos y categorías en **Ajustes → Tipos / Categorías**.

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
supabase/esquema.sql        instalación completa desde cero
supabase/actualizacion-v3.sql  migración para proyectos con datos
supabase/multiusuario.sql   cuentas separadas y políticas por dueño
```

## Licencias

`@imgly/background-removal` se distribuye con licencia **AGPL-3.0**. Si el proyecto se publica como servicio, conviene revisar qué implica o sustituirlo por otro recorte.

## Pendiente

- Tests de interfaz (el flujo de añadir prenda, montar un outfit y crear una semana).
