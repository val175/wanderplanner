import { pluralize } from '../../utils/helpers'

export default function SidebarFooter({ count, onSignOut }) {
  return (
    <div className="px-5 py-4 border-t border-border-strong flex items-center justify-between">
      <p className="text-xs text-text-muted">
        {count} {pluralize(count, 'trip')} planned
      </p>
      {onSignOut && (
        <button
          onClick={onSignOut}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          title="Sign out"
        >
          Sign out
        </button>
      )}
    </div>
  )
}
