// Python bridge client: spawns gui/bridge.py and exposes a promise-based
// JSON-RPC over stdio, forwarding streamed events (progress/log) to callers.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { EventEmitter } from 'node:events'
import type { BridgeEvent } from '../shared/types'

interface Pending {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
}

export class PythonBridge extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1

  constructor(
    private readonly cmd: string,
    private readonly args: string[],
    private readonly cwd: string,
    private readonly env?: NodeJS.ProcessEnv
  ) {
    super()
  }

  /** Spawns the Python process and starts listening for protocol frames. */
  start(): void {
    if (this.proc) return
    this.proc = spawn(this.cmd, this.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    const rl = createInterface({ input: this.proc.stdout })
    rl.on('line', (line) => {
      let obj: unknown
      try {
        obj = JSON.parse(line)
      } catch {
        return
      }
      const frame = obj as { event?: string; id?: number; result?: unknown; error?: string; data?: unknown }
      if (frame.event) {
        // Rebuild the typed BridgeEvent: progress events carry their payload in
        // `data`, log events are flattened (level/message sit on the event).
        if (frame.event === 'log') {
          this.emit('event', { type: 'log', ...(frame.data as object) } as BridgeEvent)
        } else {
          this.emit('event', { type: frame.event, data: frame.data } as BridgeEvent)
        }
        return
      }
      if (typeof frame.id === 'number') {
        const pending = this.pending.get(frame.id)
        if (!pending) return
        this.pending.delete(frame.id)
        if (frame.error) pending.reject(new Error(frame.error))
        else pending.resolve(frame.result)
      }
    })

    this.proc.stderr.on('data', (d: Buffer) => {
      console.error(`[bridge] ${String(d).trimEnd()}`)
    })
    this.proc.on('exit', (code) => {
      this.proc = null
      this.emit('exit', code)
    })
    this.proc.on('error', (err) => {
      this.emit('exit', null)
      console.error(`[bridge] spawn error: ${err.message}`)
    })
  }

  /** Sends one RPC request and resolves with the response's result field. */
  request<T>(method: string, params: unknown = {}): Promise<T> {
    if (!this.proc) {
      return Promise.reject(new Error('Python bridge is not running'))
    }
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject
      })
      this.proc!.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    })
  }

  /** Kills the Python process if it is still running. */
  dispose(): void {
    if (this.proc) {
      this.proc.kill()
      this.proc = null
    }
  }
}
