'use client'

import ErrorView from '@/components/error-view'

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorView error={error} retry={unstable_retry} />
}
