import { describe, it, expect } from 'vitest'
import {
  removeFillerWords,
  replaceITTerms,
  processRecognizedText,
  structureForSlack,
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

    it('should remove additional filler words', () => {
      expect(removeFillerWords('なんていうかすごいですね')).toBe('すごいですね')
      expect(removeFillerWords('ほら、これが問題で')).toBe('これが問題で')
      expect(removeFillerWords('やっぱりこれがいいですね')).toBe('これがいいですね')
      expect(removeFillerWords('なんというかこの機能は')).toBe('この機能は')
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

    it('should replace project management terms', () => {
      expect(replaceITTerms('バックログのプライオリティを整理した')).toBe('backlogのpriorityを整理した')
      expect(replaceITTerms('ジラのチケットを作成して')).toBe('Jiraのticketを作成して')
    })

    it('should replace architecture terms', () => {
      expect(replaceITTerms('モノレポのアーキテクチャで')).toBe('monorepoのarchitectureで')
      expect(replaceITTerms('ホットフィックスをロールバックした')).toBe('hotfixをrollbackした')
    })

    it('should replace testing terms', () => {
      expect(replaceITTerms('ユニットテストのテストカバレッジを上げる')).toBe('unit testのtest coverageを上げる')
    })

    it('should replace additional tool names', () => {
      expect(replaceITTerms('ギットハブアクションズでデプロイする')).toBe('GitHub Actionsでdeployする')
      expect(replaceITTerms('センチリーでエラーを確認した')).toBe('Sentryでエラーを確認した')
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

    it('should handle complex IT conversation with fillers', () => {
      const input = 'なんていうかバックログのプライオリティを見直して、えーとギットハブアクションズのパイプラインも修正した'
      const result = processRecognizedText(input)
      expect(result).toBe('backlogのpriorityを見直して、GitHub Actionsのpipelineも修正した')
    })
  })

  describe('structureForSlack', () => {
    it('should return empty string for empty input', () => {
      expect(structureForSlack('')).toBe('')
    })

    it('should return single sentence as-is', () => {
      expect(structureForSlack('今日のmeetingの件です。')).toBe('今日のmeetingの件です。')
    })

    it('should group sentences into paragraphs', () => {
      const input = 'deployが完了しました。本番環境で確認済みです。stagingも問題ありません。また次のsprintのbacklogを整理しました。priorityの見直しが必要です。'
      const result = structureForSlack(input)
      // Should have paragraph breaks
      expect(result).toContain('\n\n')
    })

    it('should split on topic-shift conjunctions', () => {
      const input = 'Pull Requestをreviewしました。問題なさそうです。ただbugが1件見つかりました。'
      const result = structureForSlack(input)
      expect(result).toContain('\n\n')
      expect(result).toContain('ただ')
    })

    it('should handle text with existing newlines', () => {
      const input = '最初の段落です。\n次の文章です。'
      const result = structureForSlack(input)
      expect(result).toBeTruthy()
    })
  })
})
