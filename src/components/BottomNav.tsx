type BottomNavItem<T extends string> = {
  id: T
  label: string
}

type BottomNavProps<T extends string> = {
  activeTab: T
  items: BottomNavItem<T>[]
  onChange: (tab: T) => void
}

function BottomNav<T extends string>({
  activeTab,
  items,
  onChange,
}: BottomNavProps<T>) {
  return (
    <nav className="bottom-nav" aria-label="App sections">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav-button ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
