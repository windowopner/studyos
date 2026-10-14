'use client'

// Last resort when the root layout itself fails. It replaces the whole document, so it carries
// its own minimal styles instead of relying on globals.css.
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#06070c', color: '#e8ebf5', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <title>StudyOS</title>
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>StudyOS couldn&apos;t load</h1>
          <p style={{ color: '#9097ad', fontSize: 14, lineHeight: 1.6 }}>Something went wrong while starting the app. Your saved work is safe.</p>
          <button
            onClick={() => unstable_retry()}
            style={{ marginTop: 12, padding: '10px 16px', borderRadius: 12, border: 0, background: '#8aa4ff', color: '#0b1024', fontWeight: 500, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
