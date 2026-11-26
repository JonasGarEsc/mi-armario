import { lazy } from 'react'
import { vibrar } from '../lib/vibrar'
import FormularioConjunto from './FormularioConjunto'
import Filtros from './Filtros'
import Ajustes from './Ajustes'

// Todo lo que solo se ve dentro de una hoja pesa y se descarga al abrirla:
// el motor de recorte, las estadísticas, la carga masiva, etc.
const FormularioPrenda = lazy(() => import('./FormularioPrenda'))
const FormularioEdicion = lazy(() => import('./FormularioEdicion'))
const FormularioMaleta = lazy(() => import('./FormularioMaleta'))
const FormularioSemana = lazy(() => import('./FormularioSemana'))
const SelectorPrendas = lazy(() => import('./SelectorPrendas'))
const QueMePongo = lazy(() => import('./QueMePongo'))
const AsistenteMaleta = lazy(() => import('./AsistenteMaleta'))
const Estadisticas = lazy(() => import('./Estadisticas'))
const CargaMasiva = lazy(() => import('./CargaMasiva'))
const OutfitsConDeseo = lazy(() => import('./OutfitsConDeseo'))
const ConfirmarUso = lazy(() => import('./ConfirmarUso'))
const Gestores = lazy(() => import('./Gestores'))
const FichaPrenda = lazy(() => import('./FichaPrenda'))
const VistaHoy = lazy(() => import('./VistaHoy'))

/** Contenido de cada hoja, elegido por el tipo de modal activo. */
export default function ContenidoHoja({
  modalActivo, prendaFicha, prendaAEditar, modoDeseo, usoPendiente,
  maletaAsistente, objetivoSemana, maletasDisponibles, deseoElegido,
  prendaFijada, filtroActual, datosMenu, temaOscuro, sesion,
  mostrarToast, cerrarModal, abrirModal, recargarVistas, prepararMaleta,
  guardarConjunto, crearOutfitSemana, aplicarFiltro, exportarDatos,
  alElegirCopia, cerrarSesion, solicitarConfirmacionGlobal,
  setTemaOscuro, setPrendaAEditar, setPrendaFijada, setRefrescoMaleta,
  setPestañaActiva,
}) {
  return (
    <>
      {modalActivo === 'ficha' && prendaFicha && (
        <FichaPrenda
          prenda={prendaFicha}
          mostrarToast={mostrarToast}
          onEditar={(prenda) => { setPrendaAEditar(prenda); abrirModal('editar') }}
          onQueMePongo={(prenda) => { setPrendaFijada(prenda.id); abrirModal('que_me_pongo') }}
        />
      )}
      {modalActivo === 'formulario' && (
        <FormularioPrenda deseo={modoDeseo} onVarias={() => abrirModal('carga_masiva')} onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast(modoDeseo ? 'Añadido a tus deseos' : 'Prenda añadida', 'exito') }} />
      )}
      {modalActivo === 'editar' && prendaAEditar && <FormularioEdicion prenda={prendaAEditar} onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Prenda editada", "exito") }} onCancelar={cerrarModal} />}
      {modalActivo === 'crear_maleta' && <FormularioMaleta onExito={(maleta) => {
        cerrarModal(); recargarVistas(); vibrar([50, 50])
        mostrarToast('Maleta creada', 'exito', maleta?.fecha_inicio ? { texto: 'Prepárala por mí', onClick: () => prepararMaleta(maleta) } : null)
      }} onCancelar={cerrarModal} />}
      {modalActivo === 'confirmar_uso' && usoPendiente && (
        <ConfirmarUso outfit={usoPendiente} mostrarToast={mostrarToast} onHecho={() => { cerrarModal(); recargarVistas() }} />
      )}
      {modalActivo === 'asistente_maleta' && maletaAsistente && (
        <AsistenteMaleta
          maleta={maletaAsistente}
          mostrarToast={mostrarToast}
          onHecho={() => { cerrarModal(); setRefrescoMaleta(n => n + 1); setPestañaActiva('conjuntos') }}
        />
      )}
      {modalActivo === 'crear_semana' && <FormularioSemana onExito={() => { cerrarModal(); recargarVistas(); setPestañaActiva('semana'); vibrar([50, 50]); mostrarToast("Semana creada", "exito") }} onCancelar={cerrarModal} />}
      {modalActivo === 'elegir_prendas' && objetivoSemana && (
        <SelectorPrendas
          fecha={objetivoSemana.fecha}
          nombreSemana={objetivoSemana.semana.nombre}
          onGuardar={crearOutfitSemana}
          onCancelar={cerrarModal}
        />
      )}

      {modalActivo === 'crear_conjunto' && (
        <FormularioConjunto maletas={maletasDisponibles} onSubmit={guardarConjunto} />
      )}

      {modalActivo === 'filtros' && (
        <Filtros
          datosMenu={datosMenu}
          filtroActual={filtroActual}
          onAplicar={aplicarFiltro}
          onAbrirTipos={() => abrirModal('tipos')}
          onAbrirCategorias={() => abrirModal('categorias')}
        />
      )}

      {modalActivo === 'que_me_pongo' && (
        <QueMePongo
          key={prendaFijada || 'libre'}
          prendaInicial={prendaFijada}
          mostrarToast={mostrarToast}
          onHecho={() => { cerrarModal(); recargarVistas(); setPestañaActiva('semana') }}
        />
      )}

      {modalActivo === 'hoy' && (
        <VistaHoy
          mostrarToast={mostrarToast}
          onHecho={() => { cerrarModal(); recargarVistas() }}
        />
      )}

      {modalActivo === 'deseo_outfits' && deseoElegido && <OutfitsConDeseo deseo={deseoElegido} />}

      {modalActivo === 'carga_masiva' && (
        <CargaMasiva
          mostrarToast={mostrarToast}
          onGuardadas={(vacia) => { recargarVistas(); if (vacia) cerrarModal() }}
        />
      )}

      {modalActivo === 'estadisticas' && (
        <Estadisticas
          mostrarToast={mostrarToast}
          onCambio={recargarVistas}
          onProponer={(id) => { setPrendaFijada(id); abrirModal('que_me_pongo') }}
        />
      )}

      {modalActivo === 'ajustes' && (
        <Ajustes
          temaOscuro={temaOscuro}
          onTema={setTemaOscuro}
          onExportar={() => { cerrarModal(); exportarDatos() }}
          onRestaurar={alElegirCopia}
          sesion={sesion}
          onCerrarSesion={cerrarSesion}
          mostrarToast={mostrarToast}
          onVerEstadisticas={() => abrirModal('estadisticas')}
          onRecargar={recargarVistas}
        />
      )}

      {/* Le inyectamos las variables a Gestores */}
      {(modalActivo === 'tipos' || modalActivo === 'categorias') && <Gestores key={modalActivo} seccion={modalActivo} onCambio={recargarVistas} setDialogoGlobal={solicitarConfirmacionGlobal} mostrarToast={mostrarToast} />}
    </>
  )
}
