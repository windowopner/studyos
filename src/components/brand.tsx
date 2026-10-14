import Link from 'next/link'
import { Planet } from '@phosphor-icons/react/dist/ssr'

// The StudyOS mark: a ringed planet on an accent tile, with the name beside it.
export default function Brand({ href = '/dashboard', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-lg px-1 py-1">
      <span className={`brand-mark shrink-0 rounded-lg transition-transform duration-500 group-hover:rotate-[-12deg] ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}>
        <Planet size={compact ? 16 : 18} weight="fill" />
      </span>
      <span className={`font-semibold tracking-tight text-[var(--text)] ${compact ? 'text-sm' : 'text-[15px]'}`}>StudyOS</span>
    </Link>
  )
}
