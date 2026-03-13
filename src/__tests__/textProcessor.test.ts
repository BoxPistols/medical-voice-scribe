import { describe, it, expect } from 'vitest'
import {
  removeFillerWords,
  replaceITTerms,
  processRecognizedText,
} from '@/lib/textProcessor'

describe('textProcessor', () => {
  describe('removeFillerWords', () => {
    it('should remove common filler words', () => {
      expect(removeFillerWords('えーと今日の予定は')).toBe('今日の予定は')
      expect(removeFillerWords('あの、ちょっと確認したいんですが')).toBe('ちょっと確認したいんですが')
      expect(removeFillerWords('まあ、そうですね')).toBe('そうですね')
    })

    it('should remove multiple filler words in one string', () => {
      const input = 'えーと、あの、なんかプロジェクトの件なんですが'
      const result = removeFillerWords(input)
      expect(result).toBe('プロジェクトの件なんですが')
    })

    it('should handle text without filler words', () => {
      expect(removeFillerWords('普通のテキスト')).toBe('普通のテキスト')
    })

    it('should return empty string for empty input', () => {
      expect(removeFillerWords('')).toBe('')
    })
  })

  describe('replaceITTerms', () => {
    it('should replace common IT terms', () => {
      expect(replaceITTerms('プルリクエストを出してください')).toBe('Pull Requestを出してください')
      expect(replaceITTerms('プロリクエストを確認して')).toBe('Pull Requestを確認して')
    })

    it('should replace AI tool names', () => {
      expect(replaceITTerms('クロードコードを使った')).toBe('Claude Codeを使った')
      expect(replaceITTerms('ジェミニAPIで')).toBe('GeminiAPIで')
      expect(replaceITTerms('ジェミニエーピーアイで')).toBe('GeminiAPIで')
    })

    it('should replace framework names', () => {
      expect(replaceITTerms('リアクトとタイプスクリプトで書いた')).toBe('ReactとTypeScriptで書いた')
    })

    it('should replace cloud terms', () => {
      expect(replaceITTerms('ドッカーでデプロイする')).toBe('Dockerでdeployする')
    })

    it('should handle multiple replacements', () => {
      const input = 'ギットハブのプルリクエストをレビューして'
      const result = replaceITTerms(input)
      expect(result).toBe('GitHubのPull Requestをreviewして')
    })

    it('should not modify text without IT terms', () => {
      expect(replaceITTerms('今日はいい天気です')).toBe('今日はいい天気です')
    })
  })

  describe('processRecognizedText', () => {
    it('should remove fillers and replace IT terms', () => {
      const input = 'えーと、あのプルリクエストをクロードコードで作った'
      const result = processRecognizedText(input)
      expect(result).toBe('Pull RequestをClaude Codeで作った')
    })

    it('should handle empty string', () => {
      expect(processRecognizedText('')).toBe('')
    })

    it('should handle realistic speech input', () => {
      const input = 'えっと、なんかリアクトのコンポーネントをリファクタリングして、まあギットハブにコミットした'
      const result = processRecognizedText(input)
      expect(result).toBe('Reactのcomponentをrefactoringして、GitHubにcommitした')
    })
  })
})
