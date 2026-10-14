// A template remounts on every navigation, so each page gets the short rise-in.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
