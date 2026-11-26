// Rejilla ligera: Supabase reduce y recodifica la foto en AVIF (~9 kB). Si falla, se usa el original.
const conTamano = (url) =>
  url && url.includes('/storage/v1/object/public/')
    ? url.replace('/object/public/', '/render/image/public/') + '?width=480&resize=contain&quality=70&format=avif'
    : url

export default function Miniatura({ url, alt, className }) {
  return (
    <img
      src={conTamano(url)}
      onError={(e) => { if (e.currentTarget.src !== url) e.currentTarget.src = url }}
      loading="lazy"
      decoding="async"
      className={className}
      alt={alt}
    />
  )
}
