import type { SVGProps } from 'react'
import { iconRegistry, type SemanticIconName } from './iconRegistry'
import { ICON_SIZE_TOKENS, ICON_STROKE_TOKENS, ICON_TONE_TOKENS, type IconSizeToken, type IconStrokeToken, type IconToneToken } from './iconTokens'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'name' | 'color'> & {
  name: SemanticIconName
  size?: IconSizeToken | number
  tone?: IconToneToken
  stroke?: IconStrokeToken
}

function resolveSize(size: IconProps['size']): number {
  if (typeof size === 'number') return size
  return ICON_SIZE_TOKENS[size ?? 'md']
}

export function Icon({
  name,
  size = 'md',
  tone = 'default',
  stroke = 'regular',
  className,
  ...props
}: IconProps) {
  const px = resolveSize(size)
  const strokeWidth = ICON_STROKE_TOKENS[stroke]
  const color = ICON_TONE_TOKENS[tone]

  if (name === 'app-mark') {
    return (
      <svg
        className={className}
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden={props['aria-label'] ? undefined : true}
        {...props}
      >
        <path
          d="M7.25 4.75h6.5L18.25 9v10.25H7.25z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.75 4.75V9h4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.75 15.75h4.5l2.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.75" cy="15.75" r="1.45" fill="var(--surface-app)" stroke={color} strokeWidth={strokeWidth} />
        <circle cx="13.25" cy="15.75" r="1.45" fill="var(--surface-app)" stroke={color} strokeWidth={strokeWidth} />
        <circle cx="15.75" cy="12.25" r="1.45" fill="var(--surface-app)" stroke={color} strokeWidth={strokeWidth} />
      </svg>
    )
  }

  const LucideIcon = iconRegistry[name]
  return (
    <LucideIcon
      className={className}
      size={px}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  )
}
