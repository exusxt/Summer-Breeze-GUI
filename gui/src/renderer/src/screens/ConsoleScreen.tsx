/**
 * Console: a full-page viewer for the bridge's streamed sc64deployer output,
 * merged with the persisted bridge.log history so failures survive restarts.
 * This is the "why did my deploy fail" troubleshooting surface.
 */
import { useEffect, useRef, useState } from 'react'
import { ClipboardCopy, Eraser, FolderOpen, Terminal, Upload } from 'lucide-react'
import type { LogEntry } from '../../../shared/types'
import { Button, Panel, Spinner } from '../components/ui'
import { cn } from '../lib'

interface LogRow {
  id: number
  time: string | null
  level: 'info' | 'warn' | 'error'
  message: string
}

let rowId = 0
const MAX_ROWS = 2000

function timeLabel(d: Date): string {
  return d.toLocaleTimeString()
}

export function ConsoleScreen(): React.JSX.Element {
  const [rows, setRows] = useState<LogRow[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const rowsRef = useRef<LogRow[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const append = (row: LogRow): void => {
    const next = [...rowsRef.current.slice(-(MAX_ROWS - 1)), row]
    rowsRef.current = next
    setRows(next)
  }

  useEffect(() => {
    void window.api
      .logHistory()
      .then((history: LogEntry[]) => {
        for (const h of history) {
          append({ id: ++rowId, time: h.time, level: h.level, message: h.message })
        }
      })
      .finally(() => setHistoryLoaded(true))

    const off = window.api.onEvent((ev) => {
      if (ev.type !== 'log') return
      append({ id: ++rowId, time: timeLabel(new Date()), level: ev.level, message: ev.message })
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the view pinned to the newest line as output streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [rows])

  const copy = async (): Promise<void> => {
    const text = rows.map((r) => `${r.time ? `[${r.time}] ` : ''}${r.level}: ${r.message}`).join('\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setFeedback('Copied to clipboard')
    } catch {
      setFeedback('Could not copy to clipboard')
    }
  }

  const exportLog = async (): Promise<void> => {
    const res = await window.api.exportLog()
    setFeedback(res.ok ? `Exported to ${res.message}` : res.message)
  }

  const clear = (): void => {
    rowsRef.current = []
    setRows([])
  }

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Console</h2>
        </div>
        <div className="flex items-center gap-2">
          {feedback ? <span className="text-xs text-sc64-muted">{feedback}</span> : null}
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            <ClipboardCopy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportLog()}>
            <Upload className="h-3.5 w-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => void window.api.openLogsFolder()}>
            <FolderOpen className="h-3.5 w-3.5" /> Logs folder
          </Button>
          <Button variant="ghost" size="sm" onClick={clear}>
            <Eraser className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      <Panel className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex items-center justify-between border-b border-sc64-border px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-sc64-muted">
            Bridge output · last {rows.length} lines
          </span>
          {!historyLoaded ? <Spinner className="h-3.5 w-3.5" /> : null}
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
          {rows.length === 0 ? (
            <span className="text-sc64-muted/60">
              Waiting for output… Run an operation (upload, deploy, menu, music…) and its sc64deployer output will
              stream here. Persisted lines from previous sessions appear at the top.
            </span>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'whitespace-pre-wrap break-all',
                  r.level === 'error' ? 'text-sc64-bad' : r.level === 'warn' ? 'text-sc64-warn' : 'text-sc64-muted'
                )}
              >
                {r.time ? <span className="text-sc64-muted/40">[{r.time}] </span> : null}
                {r.message}
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  )
}
