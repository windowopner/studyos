import type { MouseEventHandler } from 'react'

const updateSpotlight: MouseEventHandler<HTMLElement> = (event) => {
  const bounds = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`)
  event.currentTarget.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`)
}

const resetSpotlight: MouseEventHandler<HTMLElement> = (event) => {
  event.currentTarget.style.setProperty('--spotlight-x', '50%')
  event.currentTarget.style.setProperty('--spotlight-y', '50%')
}

export const spotlightProps = {
  onMouseMove: updateSpotlight,
  onMouseLeave: resetSpotlight,
}
