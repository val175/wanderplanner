// Renders a single avatar circle — photo or initials fallback.
// Pass `levelColor` (CSS color string) to render a glowing level ring.
export default function AvatarCircle({ profile, size = 28, className = '', ring = false, levelColor }) {
  const initial = profile?.name?.trim()?.[0]?.toUpperCase() || '?'

  const photo = profile?.customPhoto || profile?.photo

  const style = {
    width: size,
    height: size,
    fontSize: size * 0.38,
    // Level ring: 2px solid outline + soft glow
    ...(levelColor ? {
      outline: `2px solid ${levelColor}`,
      outlineOffset: '1px',
      boxShadow: `0 0 6px ${levelColor}55`,
    } : {}),
  }

  return (
    <div
      className={`
        rounded-full overflow-hidden shrink-0 flex items-center justify-center
        bg-accent/20 text-accent font-semibold select-none
        ${ring ? 'ring-2 ring-bg-card' : ''}
        ${className}
      `}
      style={style}
      title={profile?.name}
    >
      {photo
        ? <img src={photo} alt={profile.name} className="w-full h-full object-cover" />
        : <span style={{ fontSize: size * 0.38 }}>{initial}</span>
      }
    </div>
  )
}
