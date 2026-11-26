const trazos = {
  ajustes: 'M4 7h10m4 0h2M4 17h2m4 0h10M14 7a2 2 0 104 0 2 2 0 10-4 0M6 17a2 2 0 104 0 2 2 0 10-4 0',
  filtro: 'M4 6h16M7 12h10M10 18h4',
  buscar: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  percha: 'M12 11V9.5a2.25 2.25 0 10-2.25-2.25M12 11l8.4 5.6a1.3 1.3 0 01-.7 2.4H4.3a1.3 1.3 0 01-.7-2.4L12 11z',
  maleta: 'M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M6 7h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2zM8 11v5m8-5v5',
  mas: 'M12 5v14M5 12h14',
  puntos: 'M5 12h.01M12 12h.01M19 12h.01',
  cerrar: 'M6 18L18 6M6 6l12 12',
  volver: 'M15 19l-7-7 7-7',
  marca: 'M5 12.5l4.5 4.5L19 7.5',
  descargar: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  duplicar: 'M9 9h10v11H9zM5 15V4h10',
  borrar: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  salir: 'M15 12H4m4-4l-4 4 4 4M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4',
  calendario: 'M7 3v3m10-3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z',
  compartir: 'M12 15V4m0 0L8 8m4-4l4 4M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5',
  lista: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
}

export default function Icono({ nombre, className = 'w-6 h-6' }) {
  return (
    <svg className={className} aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={nombre === 'puntos' ? 3 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={trazos[nombre]} />
    </svg>
  )
}
