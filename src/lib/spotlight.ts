import type { MouseEventHandler } from 'react'

// Max tilt in degrees for .interactive-card. Small on purpose: depth, not a gimmick.
const MAX_TILT = 2.5

const updateSpotlight: MouseEventHandler<HTMLElement> = (event) => {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - bounds.left
  const y = event.clientY - bounds.top
  const style = event.currentTarget.style
  style.setProperty('--spotlight-x', `${x}px`)
  style.setProperty('--spotlight-y', `${y}px`)
  style.setProperty('--tilt-x', `${(0.5 - y / bounds.height) * MAX_TILT}deg`)
  style.setProperty('--tilt-y', `${(x / bounds.width - 0.5) * MAX_TILT}deg`)
}

const resetSpotlight: MouseEventHandler<HTMLElement> = (event) => {
  const style = event.currentTarget.style
  style.setProperty('--spotlight-x', '50%')
  style.setProperty('--spotlight-y', '50%')
  style.setProperty('--tilt-x', '0deg')
  style.setProperty('--tilt-y', '0deg')
}

export const spotlightProps = {
  onMouseMove: updateSpotlight,
  onMouseLeave: resetSpotlight,
}
