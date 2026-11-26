# Perletta

Armario personal y maletas, en el navegador. Se instala como app (PWA) y guarda todo en Supabase.

[mi-armario-sooty.vercel.app](https://mi-armario-sooty.vercel.app)

![Armario en escritorio](docs/armario.png)

<img src="docs/movil.png" alt="Armario en el móvil" width="260">

En `docs/diseno/` están las demás vistas, en móvil y escritorio, claro y oscuro.

## Qué hace

- Añadir prendas con la foto recortada automáticamente en el dispositivo (sin subirla a ningún servicio).
- Organizar prendas por tipo y categoría, buscar y filtrar (el botón junto al buscador abre los filtros y la gestión de tipos y categorías).
- Montar outfits arrastrando las prendas dentro de una maleta; la posición se guarda.
- Crear maletas y duplicarlas; clima del destino y descarga del outfit como imagen.
- Tema claro y oscuro y copia de seguridad en JSON, desde Ajustes.

## Stack

React 19, Vite 8, Tailwind CSS 4, Supabase (Postgres y Storage) y vite-plugin-pwa.

## Arrancar

Necesita dos variables de entorno (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`), en un `.env` local o en el panel de Vercel.

```
npm install
npm run dev
```

## Comprobar

```
npm test    # lógica de outfits y posiciones
npm run lint
npm run build
```

## Estructura

```
src/App.jsx              armario y navegación
src/components/          galería, maletas, formularios, gestores
src/lib/                 caché local y lógica de outfits (con sus tests)
supabase/limpieza.sql    limpieza opcional de columnas y tablas sin uso
```

## Pendiente

- Login y políticas RLS por usuario: hoy la clave pública puede escribir. Es una app de un solo dueño.
- Tests de interfaz y despliegue continuo.
