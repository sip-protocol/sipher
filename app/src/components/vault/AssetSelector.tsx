import { Pill } from '../ui/Pill'

interface AssetSelectorProps {
  assets: readonly string[]
  value: string
  onChange: (asset: string) => void
}

export function AssetSelector({ assets, value, onChange }: AssetSelectorProps) {
  return (
    <div className="flex gap-2" role="group" aria-label="Select asset">
      {assets.map((asset) => (
        <Pill
          key={asset}
          label={asset}
          active={asset === value}
          onClick={() => onChange(asset)}
        />
      ))}
    </div>
  )
}
