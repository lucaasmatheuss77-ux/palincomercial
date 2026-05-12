/**
 * InsiderLogo — SVG icon matching the Insider Club brand.
 * Renders the blue circle with keyhole/person silhouette.
 * Compatible with Lucide icon interface (size + className).
 */
export default function InsiderLogo({ size = 20, className, color, style }: { size?: number; className?: string; color?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M20 2C10.059 2 2 10.059 2 20C2 29.941 10.059 38 20 38C29.941 38 38 29.941 38 20C38 10.059 29.941 2 20 2ZM20 11C17.239 11 15 13.239 15 16C15 17.84 15.995 19.447 17.487 20.254L14 31H26L22.513 20.254C24.005 19.447 25 17.84 25 16C25 13.239 22.761 11 20 11Z" 
        fill={color || '#00b0f0'} 
      />
    </svg>
  )
}
