/**
 * Left-hand navigation sidebar listing the ten Summer Breeze features. The
 * active item is tinted with the accent color; each row uses the standard
 * panel/border styling so it matches the reference app's look.
 */
import { Activity, Clock, Disc3, FolderTree, HardDrive, ListTree, Music, RefreshCcw, Upload, Zap } from 'lucide-react'
import { cn } from '../lib'

export type ScreenId =
  | 'status'
  | 'local'
  | 'cart'
  | 'compare'
  | 'upload'
  | 'quick'
  | 'menu'
  | 'music'
  | 'rtc'
  | 'browse'

const ITEMS: Array<{ id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'status', label: 'Status', icon: Activity },
  { id: 'local', label: 'Local ROMs', icon: HardDrive },
  { id: 'cart', label: 'Cart Contents', icon: ListTree },
  { id: 'compare', label: 'Compare', icon: RefreshCcw },
  { id: 'upload', label: 'Upload ROMs', icon: Upload },
  { id: 'quick', label: 'Quick Upload', icon: Zap },
  { id: 'menu', label: 'Update SC64 Menu', icon: Disc3 },
  { id: 'music', label: 'Background Music', icon: Music },
  { id: 'rtc', label: 'Sync RTC Clock', icon: Clock },
  { id: 'browse', label: 'Browse SD Card', icon: FolderTree }
]

export function Sidebar({
  active,
  onNavigate,
  disabled
}: {
  active: ScreenId
  onNavigate: (id: ScreenId) => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-sc64-border bg-sc64-panel/50 p-2">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150',
              isActive
                ? 'border border-sc64-accent/60 bg-sc64-accent/10 text-sc64-accent shadow-glow'
                : 'border border-transparent text-sc64-muted hover:bg-sc64-panel hover:text-sc64-text',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
