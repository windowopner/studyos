import Link from 'next/link'
import OrbitScene from '@/components/orbit-scene'
import Brand from '@/components/brand'

export default function NotFound() {
  return (
    <main className="space-panel flex min-h-[100dvh] flex-col px-6 py-8 sm:px-12">
      <Brand href="/" />
      <div className="mt-12 grid flex-1 items-center gap-8 lg:mt-0 lg:grid-cols-2">
        <div className="max-w-md">
          <p className="font-mono text-sm text-[var(--text-muted)]">404</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">This page drifted out of orbit.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
            The link may be old, or the item was deleted.
          </p>
          <Link href="/dashboard" className="primary-button mt-8 rounded-xl px-5 py-2.5 text-sm font-medium">
            Back to your dashboard
          </Link>
        </div>
        <div className="relative h-[320px] sm:h-[420px]">
          <OrbitScene particles={1600} planetScale={0.17} />
        </div>
      </div>
    </main>
  )
}
