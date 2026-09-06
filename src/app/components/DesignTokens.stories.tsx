import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ROLES,
  ROLE_MEANING,
  STEPS,
  STEP_MEANING,
  NEUTRALS,
  NEUTRAL_MEANING,
  SOAP_KEYS,
  SOAP_MEANING,
  FORBIDDEN_PALETTES,
  MIN_CONTRAST_RATIO,
  MIN_FONT_SIZE_PX,
  type Role,
  type Step,
} from "../../lib/designTokens";

// 実際に描画されている色を読むので、globals.css を変えるとこのカタログも変わる。
// 値を書き写さないため、カタログと実装がずれない。

function readVar(name: string): string {
  if (typeof window === "undefined") return "";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return "";
  const probe = document.createElement("div");
  probe.style.color = v;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function toRgba(color: string): [number, number, number, number] {
  const m = color.match(/[\d.]+/g);
  if (!m) return [0, 0, 0, 0];
  const n = m.map(Number);
  return [n[0], n[1], n[2], n[3] ?? 1];
}

function flatten(fg: string, bg: string): [number, number, number] {
  const f = toRgba(fg);
  const b = toRgba(bg);
  return [
    f[0] * f[3] + b[0] * (1 - f[3]),
    f[1] * f[3] + b[1] * (1 - f[3]),
    f[2] * f[3] + b[2] * (1 - f[3]),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (x: number) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg: string, bg: string): number {
  const a = luminance(flatten(fg, bg));
  const b = luminance(flatten(bg, "rgb(255,255,255)"));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ── 表示部品 ────────────────────────────────────────────────────────────

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
        {title}
      </h2>
      {lead && (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.7 }}>
          {lead}
        </p>
      )}
      {children}
    </section>
  );
}

function Swatch({ token, note }: { token: string; note?: string }) {
  const value = readVar(`--${token}`);
  const surface = readVar("--bg-primary");
  const isText = /-fg$|^ink/.test(token);
  const ratio = isText && value && surface ? contrast(value, surface) : null;
  return (
    <div
      style={{
        border: "1px solid var(--border-medium)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--bg-secondary)",
      }}
    >
      <div style={{ height: 44, background: `var(--${token})` }} />
      <div style={{ padding: "8px 10px" }}>
        <code style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{token}</code>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
          {value || "—"}
        </div>
        {note && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
            {note}
          </div>
        )}
        {ratio !== null && (
          <div
            style={{
              fontSize: 12,
              marginTop: 4,
              color: ratio >= MIN_CONTRAST_RATIO ? "var(--success-fg)" : "var(--danger-fg)",
            }}
          >
            地とのコントラスト {ratio.toFixed(2)}
            {ratio >= MIN_CONTRAST_RATIO ? " 合格" : ` 不足 (${MIN_CONTRAST_RATIO}必要)`}
          </div>
        )}
      </div>
    </div>
  );
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
  gap: 12,
};

function RoleRow({ role }: { role: Role }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <code style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{role}</code>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{ROLE_MEANING[role]}</span>
      </div>
      <div style={grid}>
        {STEPS.map((step: Step) => (
          <Swatch key={step} token={`${role}${step}`} note={STEP_MEANING[step]} />
        ))}
      </div>
    </div>
  );
}

function Example() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <button className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-strong">
        主操作
      </button>
      <button className="px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-medium hover:bg-danger-strong">
        削除
      </button>
      <span className="px-2 py-1 rounded text-xs bg-warning-soft text-warning-fg border border-warning-line">
        未処理
      </span>
      <span className="px-2 py-1 rounded text-xs bg-info-soft text-info-fg border border-info-line">
        AIの提案
      </span>
      <span className="px-2 py-1 rounded text-xs bg-success-soft text-success-fg border border-success-line">
        完了
      </span>
      <button className="px-3 py-1.5 rounded-lg text-xs bg-brand-soft text-brand-fg hover:bg-brand-soft-strong">
        薄い面のボタン
      </button>
    </div>
  );
}

function TokenCatalog() {
  return (
    <div
      style={{
        padding: 24,
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>デザイントークン</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.7 }}>
        色はここにある名前だけを使う。値は globals.css の CSS 変数が持ち、このカタログは
        描画中の実値を読んで表示している。ツールバーのテーマを切り替えると両方を確認できる。
      </p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 28px", lineHeight: 1.7 }}>
        書き方の規約は docs/design-tokens.md にある。
      </p>

      <Section title="使用例" lead="よく使う組み合わせ。迷ったらこの形に寄せる。">
        <Example />
      </Section>

      <Section
        title="役割色"
        lead="用途が重ならないよう5つに絞っている。各役割が6段を持ち、段の意味はどの役割でも同じ。"
      >
        {ROLES.map((r) => (
          <RoleRow key={r} role={r} />
        ))}
      </Section>

      <Section title="土台" lead="色みを持たない面と文字と罫線。文字は3段すべてがAAを満たす。">
        <div style={grid}>
          {NEUTRALS.map((n) => (
            <Swatch key={n} token={n} note={NEUTRAL_MEANING[n]} />
          ))}
        </div>
      </Section>

      <Section title="SOAP" lead="医療記録の4区分。役割色とは別に持ち、他の用途には使わない。">
        <div style={grid}>
          {SOAP_KEYS.map((k) => (
            <Swatch key={k} token={k} note={SOAP_MEANING[k]} />
          ))}
        </div>
      </Section>

      <Section
        title="使わない色"
        lead={`Tailwindの数字付きパレット(bg-red-50 など)は使わない。近い役割のトークンに寄せる。フォントサイズは${MIN_FONT_SIZE_PX}px未満を使わない。`}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 360 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 14px 6px 0", color: "var(--text-tertiary)", fontWeight: 600, borderBottom: "1px solid var(--border-medium)" }}>
                  使わない
                </th>
                <th style={{ textAlign: "left", padding: "6px 0", color: "var(--text-tertiary)", fontWeight: 600, borderBottom: "1px solid var(--border-medium)" }}>
                  代わりに
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(FORBIDDEN_PALETTES).map(([from, to]) => (
                <tr key={from}>
                  <td style={{ padding: "4px 14px 4px 0", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                    {from}
                  </td>
                  <td style={{ padding: "4px 0", fontFamily: "monospace", color: "var(--text-primary)" }}>{to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

const meta = {
  title: "デザイン/デザイントークン",
  component: TokenCatalog,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TokenCatalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = { name: "カタログ" };
