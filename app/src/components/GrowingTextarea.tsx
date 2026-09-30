import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { keepTextareaAboveKeyboard } from '@/lib/useKeyboardInset'

const DEFAULT_MAX = 280
const DEFAULT_MIN = 120

type GrowingTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  minPx?: number
  maxPx?: number
}

/** In-flow textarea that grows with content, then scrolls inside. */
export const GrowingTextarea = forwardRef<HTMLTextAreaElement, GrowingTextareaProps>(function GrowingTextarea(
  {
    value,
    onChange,
    minPx = DEFAULT_MIN,
    maxPx = DEFAULT_MAX,
    className,
    onFocus,
    onKeyDown,
    style,
    ...rest
  },
  forwardedRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, minPx), maxPx)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden'
  }, [value, minPx, maxPx])

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      rows={3}
      className={clsx('input text-base leading-relaxed resize-none w-full', className)}
      style={{ minHeight: minPx, maxHeight: maxPx, ...style }}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown as ((e: KeyboardEvent<HTMLTextAreaElement>) => void) | undefined}
      onFocus={(e) => {
        keepTextareaAboveKeyboard(e.currentTarget, { pageScroll: true })
        onFocus?.(e)
      }}
    />
  )
})
