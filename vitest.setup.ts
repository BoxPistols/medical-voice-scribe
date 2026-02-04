import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Web Speech API mocks
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  onstart: (() => void) | null = null

  start() {}
  stop() {}
  abort() {}
}

// @ts-expect-error - Mock global
global.SpeechRecognition = MockSpeechRecognition
// @ts-expect-error - Mock global
global.webkitSpeechRecognition = MockSpeechRecognition

class MockSpeechSynthesisUtterance {
  text = ''
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  rate = 1
  pitch = 1
  volume = 1
  onend: (() => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onstart: (() => void) | null = null

  constructor(text?: string) {
    this.text = text || ''
  }
}

// @ts-expect-error - Mock global
global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance

global.speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'Google 日本語', lang: 'ja-JP', default: true, localService: false, voiceURI: 'Google 日本語' } as SpeechSynthesisVoice,
  ]),
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
}

// URL mocks
global.URL.createObjectURL = vi.fn(() => `blob:mock-url-${Math.random()}`)
global.URL.revokeObjectURL = vi.fn()

// matchMedia mock
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

// ResizeObserver mock
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// IntersectionObserver mock
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(() => []),
}))

// Fetch mock
global.fetch = vi.fn()

// localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
