// Kenen työtä kirjaus on. Näkyy vain kun asetuksissa on työpari.
import type { Tekija } from '../lib/tyopari'

type Props = {
  value: Tekija
  onChange: (t: Tekija) => void
  pariNimi: string
}

export default function TekijaValinta({ value, onChange, pariNimi }: Props) {
  const etu = pariNimi.trim().split(' ')[0] || 'Työpari'
  const opts: { t: Tekija; label: string }[] = [
    { t: 'molemmat', label: 'Molemmat' },
    { t: 'mina', label: 'Vain minä' },
    { t: 'pari', label: `Vain ${etu}` },
  ]
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Kenen työtä">
      {opts.map((o) => (
        <button key={o.t} type="button" role="radio" aria-checked={value === o.t} onClick={() => onChange(o.t)}
          className={`py-2.5 rounded-lg text-sm font-semibold truncate px-1 ${value === o.t ? 'bg-gray-100 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
