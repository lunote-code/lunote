import { useMemo, useState, type KeyboardEvent } from 'react'

import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/localeRegistry'
import { resolvePluginCatalogUrl } from '../../plugins/pluginConstants'
import { pickLocalizedText } from '../../plugins/pluginLocalizedText'
import type { PluginCatalogScreenshot } from './pluginCatalogUiHelpers'

type Props = {
  screenshots: PluginCatalogScreenshot[]
  effectiveLocale: UiLocaleId
  t: TranslateFn
}

export function PluginScreenshotCarousel({ screenshots, effectiveLocale, t }: Props) {
  const slides = useMemo(() => screenshots.filter((shot) => shot.url.trim().length > 0), [screenshots])
  const [activeIndex, setActiveIndex] = useState(0)
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(() => new Set())

  const visibleSlides = slides.filter((shot) => !brokenUrls.has(shot.url))
  if (visibleSlides.length === 0) return null

  const safeIndex = Math.min(activeIndex, visibleSlides.length - 1)
  const active = visibleSlides[safeIndex] ?? visibleSlides[0]
  const caption = active.caption ? pickLocalizedText(active.caption, effectiveLocale) : ''
  const hasMultiple = visibleSlides.length > 1

  const goPrev = () => {
    setActiveIndex((index) => (index - 1 + visibleSlides.length) % visibleSlides.length)
  }

  const goNext = () => {
    setActiveIndex((index) => (index + 1) % visibleSlides.length)
  }

  const markBroken = (url: string) => {
    setBrokenUrls((current) => {
      if (current.has(url)) return current
      const next = new Set(current)
      next.add(url)
      return next
    })
    setActiveIndex(0)
  }

  const handleFrameKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!hasMultiple) return
    if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      goNext()
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goPrev()
    }
  }

  return (
    <div className="prefs-plugin-screenshots-block">
      <div className="prefs-plugin-screenshots-stage">
        <figure
          className={`prefs-plugin-screenshot-frame${hasMultiple ? ' prefs-plugin-screenshot-frame--interactive' : ''}`}
          onClick={hasMultiple ? goNext : undefined}
          onKeyDown={handleFrameKeyDown}
          role={hasMultiple ? 'button' : undefined}
          tabIndex={hasMultiple ? 0 : undefined}
          aria-label={hasMultiple ? t('settings.plugins.screenshotAdvance') : undefined}
        >
          <img
            className="prefs-plugin-screenshot-image"
            src={resolvePluginCatalogUrl(active.url)}
            alt={caption || t('settings.plugins.screenshotAlt')}
            loading="lazy"
            draggable={false}
            onError={() => markBroken(active.url)}
          />
        </figure>

        {caption ? <p className="prefs-plugin-screenshot-caption">{caption}</p> : null}

        {hasMultiple ? (
          <>
            <button
              type="button"
              className="prefs-plugin-screenshots-nav prefs-plugin-screenshots-nav--prev"
              aria-label={t('settings.plugins.screenshotPrevious')}
              onClick={goPrev}
            >
              <Icon name="chevron-left" size="sm" />
            </button>
            <button
              type="button"
              className="prefs-plugin-screenshots-nav prefs-plugin-screenshots-nav--next"
              aria-label={t('settings.plugins.screenshotNext')}
              onClick={goNext}
            >
              <Icon name="chevron-right" size="sm" />
            </button>
            <div
              className="prefs-plugin-screenshots-dots"
              role="radiogroup"
              aria-label={t('settings.plugins.screenshots')}
            >
              {visibleSlides.map((shot, index) => (
                <button
                  key={`${shot.url}-${index}`}
                  type="button"
                  role="radio"
                  tabIndex={index === safeIndex ? 0 : -1}
                  className={`prefs-plugin-screenshots-dot${index === safeIndex ? ' is-active' : ''}`}
                  aria-checked={index === safeIndex}
                  aria-label={t('settings.plugins.screenshotCounter', {
                    current: index + 1,
                    total: visibleSlides.length,
                  })}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
