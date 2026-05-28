/**
 * The Markdown semantics of Callout are handled in `markdownDocument.ts`:
 * - `markdown-it` parses `> [!NOTE]` etc. into **blockquote**;
 * - `liftTyporaCallouts` is promoted to `callout` node based on `parseCalloutLeadingParagraph` / `matchCalloutFirstLine`;
 * - Serialization written back by `calloutFirstLineForKind` to `>[!…]`.
 *
 * Only pure functions are exported here for reference by tests or other modules (non-regex replacement of HTML).
 */
export { matchCalloutFirstLine, calloutFirstLineForKind, CALLOUT_KINDS, parseCalloutLeadingParagraph } from '../lunaCallout'
export type { CalloutKind } from '../lunaCallout'
