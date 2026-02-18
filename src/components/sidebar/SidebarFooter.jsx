import { pluralize } from '../../utils/helpers'

export default function SidebarFooter({ count }) {
  return (
    <div className="px-5 py-4 border-t border-border">
      <p className="text-xs text-text-muted">
        {count} {pluralize(count, 'trip')} planned
      </p>
    </div>
  )
}
