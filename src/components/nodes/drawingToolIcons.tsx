import { Eraser, Hand, PenLine, type LucideProps } from 'lucide-react'

const ICON_PROPS: LucideProps = {
  size: 17,
  strokeWidth: 2,
  'aria-hidden': true,
}

export function DrawingPenIcon(props: LucideProps) {
  return <PenLine {...ICON_PROPS} {...props} />
}

export function DrawingHandIcon(props: LucideProps) {
  return <Hand {...ICON_PROPS} {...props} />
}

export function DrawingEraserIcon(props: LucideProps) {
  return <Eraser {...ICON_PROPS} {...props} />
}
