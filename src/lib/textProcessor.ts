/**
 * Text post-processor for speech recognition output
 * - Removes Japanese filler words
 * - Replaces misrecognized IT/tech terms with correct forms
 * - Formats text for Slack chat communication
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
  // 追加フィラー
  /なんていうか[、,]?\s*/g,
  /なんだろう[、,]?\s*/g,
  /何て言うか[、,]?\s*/g,
  /いわゆる[、,]?\s*/g,
  /ほら[、,]?\s*/g,
  /やっぱり[、,]?\s*/g,
  /やっぱ[、,]?\s*/g,
  /つまり[、,]?\s*(?=つまり)/g, // 重複「つまりつまり」→「つまり」
  /まあまあ[、,]?\s*/g,
  /えとー[、,]?\s*/g,
  /あのーそのー[、,]?\s*/g,
  /まあそのー?[、,]?\s*/g,
  /なんというか[、,]?\s*/g,
  /要するに[、,]?\s*(?=要するに)/g, // 重複除去
  /基本的に[、,]?\s*(?=基本的に)/g, // 重複除去
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

  // --- Git & GitHub (longer compound terms first) ---
  [/プルリクエスト/g, "Pull Request"],
  [/プロリクエスト/g, "Pull Request"],
  [/プルリク/g, "Pull Request"],
  [/マージリクエスト/g, "Merge Request"],
  [/ギットハブアクションズ/g, "GitHub Actions"],
  [/ギットハブアクション/g, "GitHub Actions"],
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
  [/バックログ/g, "backlog"],
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

  // --- Communication & Project management ---
  [/スタンドアップ/g, "standup"],
  [/レトロスペクティブ/g, "retrospective"],
  [/ストーリーポイント/g, "story point"],
  [/エスティメート/g, "estimate"],
  [/プライオリティ/g, "priority"],
  [/ブロッカー/g, "blocker"],
  [/ステークホルダー/g, "stakeholder"],
  [/マイルストーン/g, "milestone"],
  [/ロードマップ/g, "roadmap"],
  [/ノーション/g, "Notion"],
  [/コンフルエンス/g, "Confluence"],
  [/ジラ/g, "Jira"],
  [/リニア/g, "Linear"],
  [/ディスコード/g, "Discord"],

  // --- Architecture & patterns ---
  [/アーキテクチャ/g, "architecture"],
  [/マイグレーション/g, "migration"],
  [/スケーラビリティ/g, "scalability"],
  [/スケーラブル/g, "scalable"],
  [/ロードバランサー/g, "load balancer"],
  [/リバースプロキシ/g, "reverse proxy"],
  [/ゲートウェイ/g, "gateway"],
  [/マイクロフロントエンド/g, "micro frontend"],
  [/モノレポ/g, "monorepo"],
  [/ポリレポ/g, "polyrepo"],
  [/サーバーサイドレンダリング/g, "SSR"],
  [/クライアントサイドレンダリング/g, "CSR"],
  [/スタティックサイトジェネレーション/g, "SSG"],
  [/ステートマネジメント/g, "state management"],
  [/ステート管理/g, "state管理"],
  [/ホットリロード/g, "hot reload"],
  [/ホットフィックス/g, "hotfix"],
  [/ロールバック/g, "rollback"],
  [/カナリアリリース/g, "canary release"],
  [/ブルーグリーン/g, "blue-green"],
  [/フィーチャーフラグ/g, "feature flag"],
  [/フィーチャートグル/g, "feature toggle"],

  // --- Security ---
  [/オーオース/g, "OAuth"],
  [/ジェイダブリューティー/g, "JWT"],
  [/エスエスオー/g, "SSO"],
  [/ファイアウォール/g, "firewall"],
  [/エンクリプション/g, "encryption"],
  [/ハッシュ/g, "hash"],

  // --- Testing ---
  [/ユニットテスト/g, "unit test"],
  [/インテグレーションテスト/g, "integration test"],
  [/エンドツーエンド/g, "E2E"],
  [/イーツーイー/g, "E2E"],
  [/テストカバレッジ/g, "test coverage"],
  [/モック/g, "mock"],
  [/スタブ/g, "stub"],
  [/バイテスト/g, "Vitest"],

  // --- Additional tools & services ---
  [/エヌピーエム/g, "npm"],
  [/ヤーン/g, "yarn"],
  [/ピーエヌピーエム/g, "pnpm"],
  [/バン/g, "Bun"],
  [/ターボパック/g, "Turbopack"],
  [/ターボレポ/g, "Turborepo"],
  [/サーキュルシーアイ/g, "CircleCI"],
  [/ジェンキンス/g, "Jenkins"],
  [/データドッグ/g, "Datadog"],
  [/センチュリー/g, "Sentry"],
  [/センチリー/g, "Sentry"],
  [/グラファナ/g, "Grafana"],
  [/プロメテウス/g, "Prometheus"],
  [/エラスティックサーチ/g, "Elasticsearch"],
  [/カフカ/g, "Kafka"],
  [/ラビットエムキュー/g, "RabbitMQ"],
  [/ストライプ/g, "Stripe"],
  [/オース0/g, "Auth0"],
  [/オースゼロ/g, "Auth0"],
  [/アンプリファイ/g, "Amplify"],
  [/ラムダ/g, "Lambda"],
  [/イーシーツー/g, "EC2"],
  [/エスリー/g, "S3"],
  [/クラウドフロント/g, "CloudFront"],
  [/ダイナモディービー/g, "DynamoDB"],
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

/**
 * Split cleaned text into structured paragraphs for Slack chat.
 * Groups sentences by topic and inserts blank lines between paragraphs.
 */
export function structureForSlack(text: string): string {
  if (!text) return text;

  // Normalize line breaks and trim
  let result = text.replace(/\r\n/g, "\n").trim();

  // Split on sentence-ending markers (。！？) while keeping the delimiter
  const sentences = result
    .split(/(?<=[。！？\n])/g)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return result;

  // Group sentences into paragraphs (roughly 2-3 sentences each)
  const paragraphs: string[] = [];
  let current = "";
  let sentenceCount = 0;

  for (const sentence of sentences) {
    // Start a new paragraph when:
    // - current paragraph has 2-3+ sentences AND
    // - the next sentence starts a new topic (indicated by conjunctions or topic markers)
    const isTopicShift = /^(ただ|しかし|一方|また|それから|次に|あと|ちなみに|それと|あとは|それで|なので|というわけで|結局)/.test(sentence);

    if (sentenceCount >= 2 && (isTopicShift || sentenceCount >= 3)) {
      paragraphs.push(current.trim());
      current = "";
      sentenceCount = 0;
    }

    current += sentence;
    // Only count actual sentences (not just line breaks)
    if (/[。！？]$/.test(sentence)) {
      sentenceCount++;
    }
  }

  if (current.trim()) {
    paragraphs.push(current.trim());
  }

  return paragraphs.join("\n\n");
}
