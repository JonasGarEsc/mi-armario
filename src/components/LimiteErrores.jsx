import { Component } from 'react'
import { borrarSoloCache } from '../lib/cache'

// Sin esto, un dato viejo en caché deja la app en blanco sin explicación.
export default class LimiteErrores extends Component {
  state = { roto: false }

  static getDerivedStateFromError() {
    return { roto: true }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (!this.state.roto) return this.props.children
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center bg-papel text-tinta font-sans">
        <h1 className="text-xl font-semibold">Algo se ha quedado atascado</h1>
        <p className="text-tenue max-w-sm">
          Suele pasar cuando hay datos guardados de una versión anterior.
        </p>
        <button
          onClick={() => { borrarSoloCache(); location.reload() }}
          className="boton boton-primario"
        >
          Limpiar caché y recargar
        </button>
      </div>
    )
  }
}
