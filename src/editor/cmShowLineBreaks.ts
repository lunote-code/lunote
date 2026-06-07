import { Compartment, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type ViewUpdate } from '@codemirror/view'

const STORAGE_KEY = 'luna.editor.showLineBreaks'

const showLineBreaksCompartment = new Compartment()

class LineBreakMarker extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.textContent = '¶'
    span.className = 'cm-visible-line-break'
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  ignoreEvent(): boolean {
    return true
  }
}

const lineBreakMarker = new LineBreakMarker()

function buildShowLineBreaksExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none

      constructor(view: EditorView) {
        this.build(view)
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) this.build(update.view)
      }

      build(view: EditorView): void {
        const marks: Range<Decoration>[] = []
        for (const { from, to } of view.visibleRanges) {
          let pos = from
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos)
            marks.push(
              Decoration.widget({
                widget: lineBreakMarker,
                side: 1,
              }).range(line.to),
            )
            if (line.number >= view.state.doc.lines) break
            pos = line.to + 1
          }
        }
        this.decorations = Decoration.set(marks, true)
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}

export function readShowLineBreaksEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeShowLineBreaksEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function createShowLineBreaksCompartmentExtension(): Extension {
  return showLineBreaksCompartment.of(
    readShowLineBreaksEnabled() ? buildShowLineBreaksExtension() : [],
  )
}

export function toggleShowLineBreaks(view: EditorView | null | undefined): boolean {
  const next = !readShowLineBreaksEnabled()
  writeShowLineBreaksEnabled(next)
  if (view) {
    view.dispatch({
      effects: showLineBreaksCompartment.reconfigure(next ? buildShowLineBreaksExtension() : []),
    })
  }
  return next
}

export function reconfigureShowLineBreaks(view: EditorView | null | undefined): void {
  if (!view) return
  view.dispatch({
    effects: showLineBreaksCompartment.reconfigure(
      readShowLineBreaksEnabled() ? buildShowLineBreaksExtension() : [],
    ),
  })
}
