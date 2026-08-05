// Preload bridge: the only script that runs in the isolated renderer context.
// It exposes a typed, promise-based window.api to the React renderer. Every
// method is a thin ipcRenderer.invoke/send wrapper over the main-process IPC.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppConfig, BridgeEvent, CompareResult, DeviceStatus, DownloadProgress, LocalRom, MenuDownloadResult, MenuFile, MenuReleaseInfo, MenuSource, MusicFile, PythonStatus, RomsAddResult, RtcResult, SdEntry, UpdateState, UploadResult } from '../shared/types'

const api = {
  // Python-bridge passthrough (request/response).
  config: (): Promise<AppConfig> => ipcRenderer.invoke('sb:config'),
  status: (): Promise<DeviceStatus> => ipcRenderer.invoke('sb:status'),
  listLocalRoms: (): Promise<LocalRom[]> => ipcRenderer.invoke('sb:listLocalRoms'),
  listCart: (path?: string): Promise<SdEntry[]> => ipcRenderer.invoke('sb:listCart', path ? { path } : {}),
  allSdRoms: (path?: string): Promise<SdEntry[]> => ipcRenderer.invoke('sb:allSdRoms', path ? { path } : {}),
  compare: (): Promise<CompareResult> => ipcRenderer.invoke('sb:compare'),
  upload: (paths: string[], sdPath: string): Promise<UploadResult> => ipcRenderer.invoke('sb:upload', { paths, sd_path: sdPath }),
  menuList: (): Promise<MenuFile[]> => ipcRenderer.invoke('sb:menuList'),
  menuBackup: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sb:menuBackup'),
  menuUpload: (path: string): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sb:menuUpload', { path }),
  musicStatus: (): Promise<{ hasMusic: boolean }> => ipcRenderer.invoke('sb:musicStatus'),
  musicList: (): Promise<MusicFile[]> => ipcRenderer.invoke('sb:musicList'),
  musicUpload: (path: string): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sb:musicUpload', { path }),
  musicRemove: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sb:musicRemove'),
  syncRtc: (): Promise<RtcResult> => ipcRenderer.invoke('sb:syncRtc'),
  browse: (path?: string): Promise<SdEntry[]> => ipcRenderer.invoke('sb:browse', path ? { path } : {}),

  // SC64 menu downloads.
  menuReleases: (): Promise<MenuReleaseInfo[]> => ipcRenderer.invoke('menu:releases'),
  menuDownload: (repo: MenuSource): Promise<MenuDownloadResult> => ipcRenderer.invoke('menu:download', { repo }),

  // App helpers.
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  reveal: (path: string): Promise<void> => ipcRenderer.invoke('app:reveal', path),
  downloadDeployer: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sb:downloadDeployer'),
  addRoms: (): Promise<RomsAddResult | null> => ipcRenderer.invoke('roms:add'),
  pythonStatus: (): Promise<PythonStatus> => ipcRenderer.invoke('app:pythonStatus'),
  installPython: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('app:installPython'),
  retryBridge: (): Promise<PythonStatus> => ipcRenderer.invoke('app:retryBridge'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('updates:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updates:install'),

  // Frameless-window controls.
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('win:minimize'),
  windowToggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('win:toggleMaximize'),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('win:close'),

  // Subscriptions; both return an unsubscribe function for React effects.
  onWindowMaximized: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, maximized: boolean): void => cb(maximized)
    ipcRenderer.on('win:maximized', listener)
    return () => ipcRenderer.removeListener('win:maximized', listener)
  },
  onEvent: (cb: (ev: BridgeEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, ev: BridgeEvent): void => cb(ev)
    ipcRenderer.on('sb:event', listener)
    return () => ipcRenderer.removeListener('sb:event', listener)
  },
  onDownloadProgress: (cb: (p: DownloadProgress) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, p: DownloadProgress): void => cb(p)
    ipcRenderer.on('sb:downloadProgress', listener)
    return () => ipcRenderer.removeListener('sb:downloadProgress', listener)
  },
  onDownloadStatus: (cb: (message: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, message: string): void => cb(message)
    ipcRenderer.on('sb:downloadStatus', listener)
    return () => ipcRenderer.removeListener('sb:downloadStatus', listener)
  },
  onMenuDownloadProgress: (cb: (p: DownloadProgress) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, p: DownloadProgress): void => cb(p)
    ipcRenderer.on('menu:downloadProgress', listener)
    return () => ipcRenderer.removeListener('menu:downloadProgress', listener)
  },
  onMenuDownloadStatus: (cb: (message: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, message: string): void => cb(message)
    ipcRenderer.on('menu:downloadStatus', listener)
    return () => ipcRenderer.removeListener('menu:downloadStatus', listener)
  },
  onUpdate: (cb: (state: UpdateState) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, state: UpdateState): void => cb(state)
    ipcRenderer.on('sb:update', listener)
    return () => ipcRenderer.removeListener('sb:update', listener)
  }
}

/** The shape of window.api; declared for the renderer in index.d.ts. */
export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
