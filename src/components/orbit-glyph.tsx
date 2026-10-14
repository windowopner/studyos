// Small ringed planet for empty states, with one moon on a slow orbit. Pure CSS.
export default function OrbitGlyph() {
  return (
    <span aria-hidden className="orbit-glyph mx-auto mb-4 block">
      <span className="orbit-glyph-ring"><span className="orbit-glyph-moon" /></span>
    </span>
  )
}
