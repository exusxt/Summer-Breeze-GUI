/**
 * Shared renderer hooks. useOperationLog subscribes to the bridge's streamed
 * log events and keeps the most recent lines so operation screens can show a
 * live console, mirroring the reference app's Run step log.
 */
import { useEffect, useRef, useState } from 'react'

export interface LogLine {
  id: number
  level: 'info' | 'warn' | 'error'
  message: string
}

let logIdCounter = 0

/** Keeps the latest 100 bridge log lines, with a clear() to reset on new ops. */
export function useOperationLog(): { lines: LogLine[]; clear: () => void } {
  const [lines, setLines] = useState<LogLine[]>([])
  const linesRef = useRef<LogLine[]>([])

  useEffect(() => {
    const off = window.api.onEvent((ev) => {
      if (ev.type !== 'log') return
      const next = [...linesRef.current.slice(-99), { id: ++logIdCounter, level: ev.level, message: ev.message }]
      linesRef.current = next
      setLines(next)
    })
    return off
  }, [])

  return {
    lines,
    clear: () => {
      linesRef.current = []
      setLines([])
    }
  }
}
