import type { ReactNode } from 'react'

type PanelProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  className?: string
}

function Panel({
  eyebrow,
  title,
  description,
  children,
  className,
}: PanelProps) {
  return (
    <section className={`panel ${className ?? ''}`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <p className="panel-description">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default Panel
