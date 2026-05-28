import { forwardRef, memo, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type LunaCodeToolbarButtonProps = {
  /** `icon`: square icon button; `chip`: language bar pill*/
  variant?: 'icon' | 'chip'
  pressed?: boolean
  /** Prevent mousedown default behavior (duplicate button to avoid grabbing focus)*/
  preventMouseDownDefault?: boolean
  children: ReactNode
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className'>

/**
 * The code block toolbar unified buttons: height, rounded corners, hover/active are consistent with the focus ring (design system entrance).
 */
export const LunaCodeToolbarButton = memo(
  forwardRef<HTMLButtonElement, LunaCodeToolbarButtonProps>(function LunaCodeToolbarButton(
    {
      variant = 'icon',
      pressed,
      preventMouseDownDefault = false,
      children,
      className = '',
      onMouseDown,
      ...rest
    },
    ref,
  ) {
    const v = variant === 'chip' ? 'luna-btn--chip' : 'luna-btn--icon'
    const merged = ['luna-btn', v, className].filter(Boolean).join(' ')

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      if (preventMouseDownDefault) e.preventDefault()
      onMouseDown?.(e)
    }

    return (
      <button ref={ref} type="button" className={merged} aria-pressed={pressed} {...rest} onMouseDown={handleMouseDown}>
        {children}
      </button>
    )
  }),
)
