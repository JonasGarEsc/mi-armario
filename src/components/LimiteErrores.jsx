import { Component } from 'react'

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
      <div className="h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-xl font-bold">Algo se ha quedado atascado</h1>
        <p className="text-sm text-neutral-500 max-w-sm">
          Suele pasar cuando hay datos guardados de una versión anterior.
        </p>
        <button
          onClick={() => { localStorage.clear(); location.reload() }}
          className="bg-black text-white font-bold px-6 py-3 rounded-[2px]"
        >
          Limpiar caché y recargar
        </button>
      </div>
    )
  }
}
