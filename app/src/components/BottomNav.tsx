type View = 'stream' | 'vault' | 'herald' | 'squad'

const TABS: { id: View, label: string, icon: string, activeIcon: string }[] = [
  { id: 'stream', label: 'Stream', icon: 'ph ph-waves', activeIcon: 'ph-fill ph-waves' },
  { id: 'vault', label: 'Vault', icon: 'ph ph-vault', activeIcon: 'ph-fill ph-vault' },
  { id: 'herald', label: 'HERALD', icon: 'ph ph-broadcast', activeIcon: 'ph-fill ph-broadcast' },
  { id: 'squad', label: 'Squad', icon: 'ph ph-users-three', activeIcon: 'ph-fill ph-users-three' },
]

export default function BottomNav({ active, onChange }: { active: View, onChange: (v: View) => void }) {
  return (
    <nav className="flex w-full px-2 pb-1 border-t border-[#1E1E22]/50">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
            active === tab.id ? 'text-[#F5F5F5]' : 'text-[#71717A] hover:text-[#CCC]'
          }`}
        >
          <i className={`${active === tab.id ? tab.activeIcon : tab.icon} text-[20px]`} />
          <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
