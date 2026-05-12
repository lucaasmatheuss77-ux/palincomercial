'use client'

import { toast } from 'sonner'

type PlaceholderActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string
  title?: string
}

export default function PlaceholderActionButton({
  message,
  title = 'Acao iniciada',
  onClick,
  children,
  ...props
}: PlaceholderActionButtonProps) {
  return (
    <button
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          toast.info(title, { description: message })
        }
      }}
    >
      {children}
    </button>
  )
}
