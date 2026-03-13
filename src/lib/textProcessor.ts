/**
 * Text post-processor for speech recognition output
 * - Removes Japanese filler words
 * - Replaces misrecognized IT/tech terms with correct forms
 */

/** Filler word patterns to remove from recognized text */
const FILLER_PATTERNS: RegExp[] = [
  /えーと[、,]?\s*/g,
  /えーっと[、,]?\s*/g,
  /えっと[、,]?\s*/g,
  /あのー?[、,]?\s*/g,
  /あのう[、,]?\s*/g,
  /まあ[、,]?\s*/g,
  /まー[、,]?\s*/g,
  /そのー?[、,]?\s*/g,
  /なんか[、,]?\s*/g,
  /こう[、,]\s*/g,       // 「こう、」のみ（文中の「こう」は残す）
  /ええと[、,]?\s*/g,
  /うーん[、,]?\s*/g,
  /うん[、,]\s*/g,
  /んー[、,]?\s*/g,
  /えー[、,]?\s*/g,
  /あー[、,]?\s*/g,
  /ちょっと[、,]?\s*(?=ちょっと)/g, // 重複「ちょっとちょっと」→「ちょっと」
];

/**
 * IT/Tech term replacement dictionary
 * Key: katakana/misrecognized form (case-insensitive regex pattern)
 * Value: correct term
 */
const IT_TERM_DICTIONARY: [RegExp, string][] = [
  // --- Development tools & AI ---
  [/クロードコード/g, "Claude Code"],
  [/クロード・コード/g, "Claude Code"],
  [/クロード/g, "Claude"],
  [/ジェミニ/g, "Gemini"],
  [/チャットジーピーティー/g, "ChatGPT"],
  [/チャット?GPT/g, "ChatGPT"],
  [/ジーピーティー/g, "GPT"],
  [/コパイロット/g, "Copilot"],
  [/コーパイロット/g, "Copilot"],
  [/オープンエーアイ/g, "OpenAI"],
  [/オープンAI/g, "OpenAI"],

  // --- Git & GitHub ---
  [/プルリクエスト/g, "Pull Request"],
  [/プロリクエスト/g, "Pull Request"],
  [/プルリク/g, "Pull Request"],
  [/マージリクエスト/g, "Merge Request"],
  [/ギットハブ/g, "GitHub"],
  [/ギット・ハブ/g, "GitHub"],
  [/ギットラブ/g, "GitLab"],
  [/ギット/g, "Git"],
  [/コミット/g, "commit"],
  [/ブランチ/g, "branch"],
  [/マージ/g, "merge"],
  [/リベース/g, "rebase"],
  [/チェリーピック/g, "cherry-pick"],
  [/プッシュ/g, "push"],
  [/プル/g, "pull"],
  [/クローン/g, "clone"],
  [/フォーク/g, "fork"],
  [/リポジトリ/g, "repository"],
  [/レポジトリ/g, "repository"],
  [/リードミー/g, "README"],

  // --- Web frameworks & libraries ---
  [/リアクト/g, "React"],
  [/ネクストジェイエス/g, "Next.js"],
  [/ネクスト・?ジェイエス/g, "Next.js"],
  [/ネクストJS/g, "Next.js"],
  [/ビュー・?ジェイエス/g, "Vue.js"],
  [/ビューJS/g, "Vue.js"],
  [/アンギュラー/g, "Angular"],
  [/スベルト/g, "Svelte"],
  [/タイプスクリプト/g, "TypeScript"],
  [/ジャバスクリプト/g, "JavaScript"],
  [/ノード・?ジェイエス/g, "Node.js"],
  [/ノードJS/g, "Node.js"],
  [/エクスプレス/g, "Express"],
  [/テイルウィンド/g, "Tailwind"],
  [/テールウィンド/g, "Tailwind"],
  [/ウェブパック/g, "webpack"],
  [/バイト/g, "Vite"],

  // --- Languages ---
  [/パイソン/g, "Python"],
  [/ラスト/g, "Rust"],
  [/ゴーラング/g, "Go"],
  [/コトリン/g, "Kotlin"],
  [/スウィフト/g, "Swift"],

  // --- Cloud & Infrastructure ---
  [/エーダブリューエス/g, "AWS"],
  [/アマゾンウェブサービス/g, "AWS"],
  [/ジーシーピー/g, "GCP"],
  [/グーグルクラウド/g, "Google Cloud"],
  [/アジュール/g, "Azure"],
  [/ドッカー/g, "Docker"],
  [/クーバネティス/g, "Kubernetes"],
  [/クバネティス/g, "Kubernetes"],
  [/クーバネテス/g, "Kubernetes"],
  [/テラフォーム/g, "Terraform"],

  // --- General IT terms ---
  [/エーピーアイ/g, "API"],
  [/エンドポイント/g, "endpoint"],
  [/デプロイ/g, "deploy"],
  [/インフラ/g, "infra"],
  [/サーバーレス/g, "serverless"],
  [/マイクロサービス/g, "microservices"],
  [/コンテナ/g, "container"],
  [/フレームワーク/g, "framework"],
  [/ライブラリ/g, "library"],
  [/パッケージ/g, "package"],
  [/モジュール/g, "module"],
  [/コンポーネント/g, "component"],
  [/リファクタリング/g, "refactoring"],
  [/リファクタ/g, "refactor"],
  [/バックエンド/g, "backend"],
  [/フロントエンド/g, "frontend"],
  [/フルスタック/g, "fullstack"],
  [/データベース/g, "database"],
  [/キャッシュ/g, "cache"],
  [/ミドルウェア/g, "middleware"],
  [/ウェブフック/g, "webhook"],
  [/ウェブソケット/g, "WebSocket"],
  [/レスポンシブ/g, "responsive"],
  [/レンダリング/g, "rendering"],
  [/コールバック/g, "callback"],
  [/プロミス/g, "Promise"],
  [/アシンク/g, "async"],
  [/アウェイト/g, "await"],
  [/スキーマ/g, "schema"],
  [/ペイロード/g, "payload"],
  [/トークン/g, "token"],
  [/セッション/g, "session"],
  [/オーセンティケーション/g, "authentication"],
  [/オーソリゼーション/g, "authorization"],
  [/アイデンティティ/g, "identity"],
  [/シーアイシーディー/g, "CI/CD"],
  [/パイプライン/g, "pipeline"],
  [/レビュー/g, "review"],
  [/イシュー/g, "issue"],
  [/チケット/g, "ticket"],
  [/バグ/g, "bug"],
  [/デバッグ/g, "debug"],
  [/ログ/g, "log"],
  [/モニタリング/g, "monitoring"],
  [/ダッシュボード/g, "dashboard"],
  [/スプリント/g, "sprint"],
  [/アジャイル/g, "Agile"],
  [/スクラム/g, "Scrum"],
  [/カンバン/g, "Kanban"],
  [/スラック/g, "Slack"],
  [/フィグマ/g, "Figma"],
  [/ストーリーブック/g, "Storybook"],
  [/ジェスト/g, "Jest"],
  [/プレイライト/g, "Playwright"],
  [/サイプレス/g, "Cypress"],
  [/リンター/g, "linter"],
  [/フォーマッター/g, "formatter"],
  [/プリティア/g, "Prettier"],
  [/イーエスリント/g, "ESLint"],
  [/ポストグレス/g, "PostgreSQL"],
  [/マイエスキューエル/g, "MySQL"],
  [/モンゴDB/g, "MongoDB"],
  [/レディス/g, "Redis"],
  [/エスキューエル/g, "SQL"],
  [/グラフキューエル/g, "GraphQL"],
  [/レストAPI/g, "REST API"],
  [/レスト/g, "REST"],
  [/クラウドフレア/g, "Cloudflare"],
  [/バーセル/g, "Vercel"],
  [/ネットリファイ/g, "Netlify"],
  [/ヘロク/g, "Heroku"],
  [/ファイアベース/g, "Firebase"],
  [/スーパーベース/g, "Supabase"],
  [/プリズマ/g, "Prisma"],
  [/ドリズル/g, "Drizzle"],

  // --- Design terms ---
  [/ユーアイ/g, "UI"],
  [/ユーエックス/g, "UX"],
  [/ワイヤーフレーム/g, "wireframe"],
  [/プロトタイプ/g, "prototype"],
  [/モックアップ/g, "mockup"],
  [/デザインシステム/g, "Design System"],
  [/アクセシビリティ/g, "accessibility"],
  [/インタラクション/g, "interaction"],
];

/**
 * Remove filler words from Japanese speech recognition text
 */
export function removeFillerWords(text: string): string {
  let result = text;
  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, "");
  }
  // Clean up leftover whitespace
  result = result.replace(/\s{2,}/g, " ").trim();
  return result;
}

/**
 * Replace misrecognized katakana IT terms with correct English/standard forms
 */
export function replaceITTerms(text: string): string {
  let result = text;
  for (const [pattern, replacement] of IT_TERM_DICTIONARY) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Process speech recognition text:
 * 1. Remove filler words
 * 2. Replace IT/tech terms
 */
export function processRecognizedText(text: string): string {
  if (!text) return text;
  let result = removeFillerWords(text);
  result = replaceITTerms(result);
  return result;
}
