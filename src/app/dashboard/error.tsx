'use client'

import ErrorView from '@/components/error-view'

// Keeps the sidebar on screen when a single page fails.
export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorView error={error} retry={unstable_retry} />
}
