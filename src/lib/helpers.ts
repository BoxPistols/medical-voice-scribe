/**
 * Helper functions for Medical Voice Scribe
 * Extracted for testability
 */

/**
 * Generate a timestamp string suitable for filenames
 * Format: YYYY-MM-DDTHH-MM-SS
 */
export const getTimestampForFilename = (): string => {
  return new Date().toISOString().split(".")[0].replace(/:/g, "-");
};

/**
 * Escape a value for CSV cell
 * Wraps in double quotes and escapes internal quotes
 */
export const escapeCsvCell = (value: unknown): string => {
  return `"${String(value).replace(/"/g, '""')}"`;
};

/**
 * Detect if running on Mac/iOS platform
 */
export const isMacPlatform = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || '') ||
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || '')
  );
};

/**
 * Shortcut key definition
 */
export interface ShortcutKey {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/**
 * Format a keyboard shortcut for display
 * @param shortcut - The shortcut key definition
 * @param compact - If true, use shorter format (Cmd+R vs Cmd + R)
 */
export const formatShortcut = (
  shortcut: ShortcutKey | undefined,
  compact: boolean = false
): string => {
  if (!shortcut) return "-";

  const isMac = isMacPlatform();
  const parts: string[] = [];

  if (shortcut.meta) parts.push(isMac ? "Cmd" : "Win");
  if (shortcut.ctrl) parts.push(isMac ? "Cmd" : "Ctrl");
  if (shortcut.alt) parts.push(isMac ? "Opt" : "Alt");
  if (shortcut.shift) parts.push("Shift");

  let keyDisplay = shortcut.key.toUpperCase();
  if (keyDisplay === " ") keyDisplay = "Space";
  parts.push(keyDisplay);

  return compact ? parts.join("+") : parts.join(" + ");
};

/**
 * Extract readable text from SOAP note structure for speech synthesis
 */
export const extractTextFromSoap = (soap: {
  subjective?: { presentIllness?: string };
  objective?: { physicalExam?: string };
  assessment?: { diagnosis?: string };
  plan?: { treatment?: string };
}): string => {
  const sections: string[] = [];

  if (soap.subjective?.presentIllness) {
    sections.push(`主観的情報: ${soap.subjective.presentIllness}`);
  }
  if (soap.objective?.physicalExam) {
    sections.push(`客観的情報: ${soap.objective.physicalExam}`);
  }
  if (soap.assessment?.diagnosis) {
    sections.push(`評価: ${soap.assessment.diagnosis}`);
  }
  if (soap.plan?.treatment) {
    sections.push(`計画: ${soap.plan.treatment}`);
  }

  return sections.join("\n");
};

/**
 * Validate text input for API request
 */
export const validateTextInput = (text: string | undefined): { valid: boolean; error?: string } => {
  if (!text || text.trim() === '') {
    return { valid: false, error: 'テキストがありません' };
  }
  return { valid: true };
};

/**
 * Validate SOAP note structure
 */
export const isValidSoapNote = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') return false;
  const note = data as Record<string, unknown>;
  return 'soap' in note && typeof note.soap === 'object' && note.soap !== null;
};
