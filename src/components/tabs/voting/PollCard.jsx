import AvatarCircle from '../../shared/AvatarCircle'
import Button from '../../shared/Button'
import PollOptionCard from './PollOptionCard'

export default function PollCard({ poll, activeUserId, onVote, onResolve, onDelete, onCancel, resolveProfile, globalTokensRemaining, globalVetoesRemaining }) {
  // Determine Current Leader
  let leaderId = null
  if (poll.status === 'active') {
    let highest = 0
    poll.options.forEach(opt => {
      const vetoes = Object.values(poll.votes || {}).filter(v => v.veto === opt.id).length
      if (vetoes > 0) return
      const tokens = Object.values(poll.votes || {}).reduce((sum, v) => sum + (v.tokens[opt.id] || 0), 0)
      if (tokens > highest) {
        highest = tokens
        leaderId = opt.id
      }
    })
  }

  // Generate vote activity log
  const logs = []
  Object.entries(poll.votes || {}).forEach(([userId, voteData]) => {
    const user = resolveProfile(userId)
    Object.entries(voteData.tokens || {}).forEach(([optionId, count]) => {
      if (count > 0) {
        const option = poll.options.find(o => o.id === optionId)
        if (option) {
          logs.push({ id: `token-${userId}-${optionId}`, user, action: `placed ${count} token${count > 1 ? 's' : ''} on`, target: option.title })
        }
      }
    })
    if (voteData.veto) {
      const option = poll.options.find(o => o.id === voteData.veto)
      if (option) {
        logs.push({ id: `veto-${userId}-${voteData.veto}`, user, action: 'vetoed', target: option.title })
      }
    }
  })

  return (
    <div className="flex flex-col md:flex-row border border-border rounded-[var(--radius-xl)] bg-bg-card overflow-hidden relative mb-6">
      {/* Options container */}
      <div className="order-1 md:order-2 w-full md:w-[70%] p-4 md:p-6 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4 sm:gap-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {poll.status === 'resolved' ? (
                <span className="text-[10px] font-semibold text-success uppercase tracking-wider flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-success"></div> RESOLVED</span>
              ) : (
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div> ACTIVE POLL</span>
              )}
            </div>
            <h2 className="text-[22px] font-heading font-semibold text-text-primary leading-tight mb-2">
              {poll.title}
            </h2>
            {poll.status === 'active' && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent uppercase tracking-wider">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Closes in 24 hours
              </div>
            )}
          </div>

          {poll.status === 'active' && (
            <div className="flex flex-col gap-2 items-end w-full sm:w-auto">
              <Button onClick={() => onResolve(poll)} variant="secondary" className="w-full sm:w-auto px-5 py-2 text-[11px] uppercase tracking-wider font-semibold shadow-none hover:bg-bg-hover">
                Resolve Early
              </Button>
            </div>
          )}
        </div>

        <div className="flex overflow-x-auto gap-5 pb-4 snap-x pl-1 pt-3">
          {poll.options.map(opt => (
            <div key={opt.id} className="min-w-[240px] w-[240px] max-w-[240px] snap-start shrink-0">
              <PollOptionCard option={opt} poll={poll} activeUserId={activeUserId} onVote={onVote}
                isLeader={leaderId === opt.id} globalTokensRemaining={globalTokensRemaining}
                globalVetoesRemaining={globalVetoesRemaining} resolveProfile={resolveProfile} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-4 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            <button onClick={() => onDelete(poll.id)} className="hover:text-danger hover:underline transition-colors">Delete/Archive</button>
            {onCancel && <button onClick={() => onCancel(poll.id)} className="hover:text-accent hover:underline transition-colors">Cancel Poll & Refund</button>}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="order-2 md:order-1 w-full md:w-[30%] border-t md:border-t-0 md:border-r border-border p-4 md:p-6 bg-bg-primary flex flex-col shrink-0">
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-3 md:mb-6">Activity Log</h3>
        <div className="flex-1 space-y-4 md:space-y-5 overflow-y-auto pr-2 max-h-[200px] md:max-h-none">
          {logs.length === 0 ? (
            <p className="text-xs text-text-secondary mt-6 font-medium">Start a poll to see voting activity here.</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex gap-3 items-start relative">
                <div className="absolute left-3.5 top-8 bottom-[-20px] w-px bg-border -z-10"></div>
                <AvatarCircle profile={log.user} size={28} />
                <p className="text-[13px] text-text-secondary leading-snug">
                  <span className="font-semibold text-text-primary">{log.user?.name || 'Someone'}</span> {log.action} <span className="font-semibold text-text-primary">{log.target}</span>.
                  <span className="block text-[10px] text-text-muted uppercase font-semibold mt-1 tracking-wider">Just Now</span>
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
