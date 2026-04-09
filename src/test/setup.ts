import '@testing-library/jest-dom/vitest'

import { vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  writable: true,
  value() {
    return {
      width: 960,
      height: 480,
      top: 0,
      left: 0,
      right: 960,
      bottom: 480,
      x: 0,
      y: 0,
      toJSON() {
        return this
      },
    }
  },
})

Object.defineProperty(SVGElement.prototype, 'getBBox', {
  writable: true,
  value() {
    return {
      x: 0,
      y: 0,
      width: 120,
      height: 24,
    }
  },
})
