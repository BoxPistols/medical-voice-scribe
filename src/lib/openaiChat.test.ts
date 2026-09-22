import { describe, it, expect } from 'vitest'
import { buildChatTuning } from './openaiChat'

describe('buildChatTuning', () => {
  // gpt-6系をreasoning系として扱わないと、temperatureとmax_tokensが送られて400になる
  it('gpt-6-lunaにはtemperatureとmax_tokensを付けない', () => {
    const out = buildChatTuning('gpt-6-luna', { temperature: 0.7, maxTokens: 800 })
    expect(out).toEqual({ max_completion_tokens: 800 })
  })

  it('gpt-6-lunaでmaxTokens未指定なら床の値を使う', () => {
    const out = buildChatTuning('gpt-6-luna', { temperature: 0.7 })
    expect(out.max_completion_tokens).toBe(4000)
    expect(out).not.toHaveProperty('temperature')
  })

  it('Geminiなどそれ以外のモデルにはtemperatureとmax_tokensを渡す', () => {
    const out = buildChatTuning('gemini-3.8-flash', { temperature: 0.7, maxTokens: 800 })
    expect(out).toEqual({ temperature: 0.7, max_tokens: 800 })
  })
})
