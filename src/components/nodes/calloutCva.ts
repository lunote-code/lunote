import { cva } from 'class-variance-authority'

/** Folded state and editable header (without Tailwind: the class name is defined in lunaCalloutCard.css)*/
export const calloutRootVariants = cva('pm-callout luna-callout-card', {
  variants: {
    collapsed: {
      true: 'pm-callout--collapsed luna-callout-card--collapsed',
      false: '',
    },
  },
  defaultVariants: { collapsed: false },
})

export const calloutHeaderVariants = cva('luna-callout-card__header', {
  variants: {
    interactive: {
      true: 'luna-callout-card__header--interactive',
      false: '',
    },
  },
  defaultVariants: { interactive: false },
})
