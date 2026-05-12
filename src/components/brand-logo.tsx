import Image from 'next/image'

type BrandLogoProps = {
  alt?: string
  width?: number
  height?: number
  style?: React.CSSProperties
  showSubtitle?: boolean
  compact?: boolean
}

const LOGO_ASPECT_RATIO = 861 / 285

export default function BrandLogo({
  alt = 'Palin Martins',
  width,
  height = 48,
  style,
  compact = false,
}: BrandLogoProps) {
  const safeHeight = compact ? Math.max(34, height - 2) : height
  const computedWidth = width ?? Math.round(safeHeight * LOGO_ASPECT_RATIO)

  return (
    <div
      aria-label={alt}
      role="img"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        maxWidth: '100%',
        flexShrink: 0,
        ...style,
      }}
    >
      <Image 
        src="/logo-branco-pbg.png" 
        alt={alt} 
        width={computedWidth} 
        height={safeHeight} 
        style={{ objectFit: 'contain' }}
        priority
      />
    </div>
  )
}
