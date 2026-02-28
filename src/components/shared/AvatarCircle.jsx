// Renders a single avatar circle — photo or initials fallback
export default function AvatarCircle({ profile, size = 28, className = '', ring = false }) {
  const initial = profile?.name?.trim()?.[0]?.toUpperCase() || '?'

  const style = {
    width: size,
    height: size,
    fontSize: size * 0.38,
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
      {profile?.photo
        ? <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
        : <span style={{ fontSize: size * 0.38 }}>{initial}</span>
      }
    </div>
  )
}
