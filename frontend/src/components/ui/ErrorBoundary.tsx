import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?: string
}

interface State {
  error: Error | null
}

/**
 * Route-level guard so a malformed payload shows an error card instead of
 * blanking the whole app (A2 — the console previously threw on `.map`).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="card p-6">
        <h2 className="text-lg font-bold text-[var(--color-text)]">
          {this.props.title ?? 'This page could not be displayed'}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{this.state.error.message}</p>
        <button className="btn btn-primary mt-4" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    )
  }
}
