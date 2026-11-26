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

## Acceso

La app pide correo y contraseña. No hay registro público: la cuenta se crea a mano y solo entra quien esté en la tabla `miembros`.

1. En Supabase, **Authentication → Users → Add user**, con «Auto Confirm» marcado.
2. Pega `supabase/rls.sql` en el **SQL Editor**. Cierra las 6 tablas y el bucket: el primero de `auth.users` pasa a `miembros` automáticamente.
   Si el correo del paso 1 no es el primero de la lista, añade el tuyo:
   ```sql
   insert into public.miembros (user_id)
   select id from auth.users where email = 'tu-correo';
   ```
3. En **Authentication → Providers → Email**, desactiva «Allow new users to sign up».
4. Rota la clave pública: **Settings → API Keys**, crea la publishable key, copia su valor en
   `VITE_SUPABASE_ANON_KEY` (local y en Vercel) y revoca las claves legacy.
   El `.env` viejo sigue en el historial de Git; rotar la clave es lo que lo inutiliza.
5. Despliega **después** de los pasos 1 y 2: si no, la web se queda sin cuenta con la que entrar.

Si al entrar sale «Esta cuenta no tiene acceso», falta el `insert` del paso 2.

## Comprobar

```
npm test    # lógica de outfits y posiciones
npm run lint
npm run build
```

## Estructura

```
src/App.jsx              armario y navegación (con la puerta de acceso)
src/components/          acceso, galería, maletas, formularios, gestores
src/lib/                 caché local y lógica de outfits (con sus tests)
supabase/rls.sql         login obligatorio, miembros y políticas de las tablas y el bucket
supabase/limpieza.sql    limpieza opcional de columnas y tablas sin uso
```

## Pendiente

- Tests de interfaz y despliegue continuo.
