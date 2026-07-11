import { useEffect, useState } from 'react'

function LootItem({ item, onDone }) {
  const [phase, setPhase] = useState('spawn')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('rise'), 40)
    const t2 = setTimeout(() => setPhase('fade'), 2200)
    const t3 = setTimeout(onDone, 2700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div className={`loot-pickup lp-${phase}`}>
      <div className="loot-orb">+</div>
      <div className="loot-text-block">
        <span className="loot-pickup-label">{item.label}</span>
        {item.amount && <span className="loot-pickup-val">${item.amount}/mo FREED</span>}
      </div>
    </div>
  )
}

export default function LootDrop({ drops, onRemove }) {
  return (
    <div className="loot-stage">
      {drops.map(d => (
        <LootItem key={d.id} item={d} onDone={() => onRemove(d.id)} />
      ))}
    </div>
  )
}
