export default function ChatSidebar({ fullScreen }: { fullScreen?: boolean }) {
  return (
    <div className={`flex flex-col bg-card ${fullScreen ? 'h-full' : 'h-full w-full'}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-1.5 h-1.5 rounded-full bg-sipher" />
        <span className="text-[13px] font-semibold text-text">SIPHER</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-muted text-sm">Chat coming soon...</p>
      </div>
    </div>
  )
}
