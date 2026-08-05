/**
 * Live console panel: renders the most recent sc64deployer output lines the
 * way the reference app shows its run log, with level coloring.
 */
import { cn } from '../lib'
import type { LogLine } from '../hooks'
import { Panel } from './ui'

export function ConsolePanel({ lines, className }: { lines: LogLine[]; className?: string }): React.JSX.Element {
  return (
    <Panel className={cn('flex flex-col', className)}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">Console</div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-sc64-border bg-sc64-deep p-3 font-mono text-[11px] leading-relaxed">
        {lines.length === 0 ? (
          <span className="text-sc64-muted/60">Waiting for output…</span>
        ) : (
          lines.map((l) => (
            <div key={l.id} className={cn(l.level === 'error' ? 'text-sc64-bad' : l.level === 'warn' ? 'text-sc64-warn' : 'text-sc64-muted')}>
              {l.message}
            </div>
          ))
        )}
      </div>
    </Panel>
  )
}
