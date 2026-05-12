'use client'

import type { ButtonHTMLAttributes } from 'react'
import { toast } from 'sonner'

type DownloadActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fileName: string
  content: string
  successMessage?: string
}

export default function DownloadActionButton({
  fileName,
  content,
  successMessage = 'Arquivo gerado com sucesso.',
  onClick,
  children,
  ...props
}: DownloadActionButtonProps) {
  return (
    <button
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = fileName
        anchor.click()
        URL.revokeObjectURL(url)

        toast.success('Download iniciado', { description: successMessage })
      }}
    >
      {children}
    </button>
  )
}
