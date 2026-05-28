import type { SVGProps } from 'react'

export type LogoVariant = 'default' | 'monochrome' | 'compact'

type LogoProps = SVGProps<SVGSVGElement> & {
  variant?: LogoVariant
  size?: number
}

export function LunaLogo({ variant = 'default', size = 24, ...props }: LogoProps) {
  const stroke = variant === 'monochrome' ? 'currentColor' : 'var(--color-text-primary, var(--text-primary))'
  const accent = variant === 'monochrome' ? 'currentColor' : 'var(--color-accent-primary, var(--accent))'

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="4.25" y="3.75" width="15.5" height="16.5" rx="4" stroke={stroke} strokeWidth="1.8" />
      <path d="M14.25 3.75v4.5h5.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {variant !== 'compact' ? (
        <>
          <path d="M7.25 15.25h4.5l3.2-4.25" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7.25" cy="15.25" r="1.35" fill="var(--surface-app)" stroke={accent} strokeWidth="1.8" />
          <circle cx="11.75" cy="15.25" r="1.35" fill="var(--surface-app)" stroke={accent} strokeWidth="1.8" />
          <circle cx="14.95" cy="11" r="1.35" fill="var(--surface-app)" stroke={accent} strokeWidth="1.8" />
        </>
      ) : null}
    </svg>
  )
}
