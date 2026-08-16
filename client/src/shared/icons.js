export function iconSvg(name, size = 16, strokeWidth = 1.5) {
  return `<svg width="${size}" height="${size}" class="icon" stroke-width="${strokeWidth}"><use href="/icons.svg#tabler-${name}"></use></svg>`
}