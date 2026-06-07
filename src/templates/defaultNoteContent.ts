import type { UiLocaleId } from '../i18n/localeRegistry'
import { FALLBACK_LOCALE } from '../i18n/resolveLocale'

const NEW_NOTE_TEMPLATES: Record<UiLocaleId, string> = {
  en: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> Summarize this note in one or two sentences (optional)

## Body

## Notes

- 

`,
  'zh-CN': `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> 用一两句话概括本文（可选）

## 正文

## 备忘

- 

`,
  'zh-TW': `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> 用一兩句話概括本文（可選）

## 正文

## 備忘

- 

`,
  ja: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> このノートを一、二文で要約（任意）

## 本文

## メモ

- 

`,
  ko: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> 이 노트를 한두 문장으로 요약 (선택)

## 본문

## 메모

- 

`,
  de: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> Fassen Sie diese Notiz in ein oder zwei Sätzen zusammen (optional)

## Inhalt

## Notizen

- 

`,
  fr: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> Résumez cette note en une ou deux phrases (facultatif)

## Corps

## Notes

- 

`,
  es: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> Resume esta nota en una o dos frases (opcional)

## Cuerpo

## Notas

- 

`,
  ru: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> Кратко опишите заметку в одном-двух предложениях (необязательно)

## Основной текст

## Заметки

- 

`,
  pt: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> Resuma esta nota em uma ou duas frases (opcional)

## Corpo

## Notas

- 

`,
  it: `---
title: "{{title}}"
created: "{{date:YYYY-MM-DD}} {{time:HH:mm}}"
---

# {{title}}

> Riassumi questa nota in una o due frasi (facoltativo)

## Corpo

## Note

- 

`,
}

const DAILY_TEMPLATES: Record<UiLocaleId, string> = {
  en: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> Daily note · Created {{date:YYYY-MM-DD}} {{time:HH:mm}}

## Focus today

1. 
2. 
3. 

## Tasks

- [ ] 

## Quick notes

### {{time:HH:mm}}

`,
  'zh-CN': `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> 日记 · 创建于 {{date:YYYY-MM-DD}} {{time:HH:mm}}

## 今日重点

1. 
2. 
3. 

## 待办

- [ ] 

## 随手记

### {{time:HH:mm}}

`,
  'zh-TW': `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> 日記 · 建立於 {{date:YYYY-MM-DD}} {{time:HH:mm}}

## 今日重點

1. 
2. 
3. 

## 待辦

- [ ] 

## 隨手記

### {{time:HH:mm}}

`,
  ja: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> デイリーノート · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## 今日のフォーカス

1. 
2. 
3. 

## タスク

- [ ] 

## メモ

### {{time:HH:mm}}

`,
  ko: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> 일기 · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## 오늘의 중점

1. 
2. 
3. 

## 할 일

- [ ] 

## 메모

### {{time:HH:mm}}

`,
  de: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> Tagesnotiz · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## Fokus heute

1. 
2. 
3. 

## Aufgaben

- [ ] 

## Notizen

### {{time:HH:mm}}

`,
  fr: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> Note du jour · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## Priorités du jour

1. 
2. 
3. 

## Tâches

- [ ] 

## Notes rapides

### {{time:HH:mm}}

`,
  es: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> Nota diaria · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## Enfoque de hoy

1. 
2. 
3. 

## Tareas

- [ ] 

## Notas rápidas

### {{time:HH:mm}}

`,
  ru: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> Ежедневная заметка · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## Фокус на сегодня

1. 
2. 
3. 

## Задачи

- [ ] 

## Заметки

### {{time:HH:mm}}

`,
  pt: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> Nota diária · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## Foco de hoje

1. 
2. 
3. 

## Tarefas

- [ ] 

## Notas rápidas

### {{time:HH:mm}}

`,
  it: `---
title: "{{date:YYYY-MM-DD}}"
tags:
  - daily
---

# {{date:YYYY-MM-DD}}

> Nota del giorno · {{date:YYYY-MM-DD}} {{time:HH:mm}}

## Focus di oggi

1. 
2. 
3. 

## Attività

- [ ] 

## Appunti

### {{time:HH:mm}}

`,
}

const FALLBACK_NOTE_HEADINGS: Record<UiLocaleId, { body: string; untitled: string }> = {
  en: { body: 'Body', untitled: 'New note' },
  'zh-CN': { body: '正文', untitled: '新笔记' },
  'zh-TW': { body: '正文', untitled: '新筆記' },
  ja: { body: '本文', untitled: '新しいノート' },
  ko: { body: '본문', untitled: '새 노트' },
  de: { body: 'Inhalt', untitled: 'Neue Notiz' },
  fr: { body: 'Corps', untitled: 'Nouvelle note' },
  es: { body: 'Cuerpo', untitled: 'Nueva nota' },
  ru: { body: 'Основной текст', untitled: 'Новая заметка' },
  pt: { body: 'Corpo', untitled: 'Nova nota' },
  it: { body: 'Corpo', untitled: 'Nuova nota' },
}

function pickLocale(locale: UiLocaleId): UiLocaleId {
  return NEW_NOTE_TEMPLATES[locale] ? locale : FALLBACK_LOCALE
}

/** Default new-note template body for seeding `Templates/Default.md` (per UI locale). */
export function getDefaultNewNoteTemplate(locale: UiLocaleId): string {
  const id = pickLocale(locale)
  return NEW_NOTE_TEMPLATES[id] ?? NEW_NOTE_TEMPLATES[FALLBACK_LOCALE]
}

/** Default daily template body for seeding `Templates/Daily.md` (per UI locale). */
export function getDefaultDailyTemplate(locale: UiLocaleId): string {
  const id = pickLocale(locale)
  return DAILY_TEMPLATES[id] ?? DAILY_TEMPLATES[FALLBACK_LOCALE]
}

/** Default body when no template file is used (follows UI locale). */
export function buildDefaultNoteContent(title: string, locale: UiLocaleId = FALLBACK_LOCALE): string {
  const id = pickLocale(locale)
  const headings = FALLBACK_NOTE_HEADINGS[id] ?? FALLBACK_NOTE_HEADINGS[FALLBACK_LOCALE]
  const safe = title.trim() || headings.untitled
  return `---\ntitle: ${safe}\n---\n\n# ${safe}\n\n## ${headings.body}\n\n`
}

/** @deprecated Use getDefaultNewNoteTemplate('zh-CN') — kept for importers expecting the legacy constant. */
export const DEFAULT_NEW_NOTE_TEMPLATE = getDefaultNewNoteTemplate('zh-CN')

/** @deprecated Use getDefaultDailyTemplate('zh-CN') */
export const DEFAULT_DAILY_TEMPLATE = getDefaultDailyTemplate('zh-CN')
