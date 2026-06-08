import { Component } from 'react'
import Button from './Button'
import Card from './Card'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center animate-fade-in">
          <Card className="max-w-md p-8 flex flex-col items-center gap-4">
            <span className="text-4xl">⚠️</span>
            <h2 className="font-heading font-semibold text-xl text-text-primary">
              Something went wrong in this tab
            </h2>
            <p className="text-sm text-text-secondary text-balance">
              Wanderplan encountered an error while rendering this section. You can try refreshing the tab or returning to the overview.
            </p>
            {this.state.error && (
              <pre className="w-full text-left text-xs font-mono bg-bg-secondary p-3 rounded-[var(--radius-sm)] text-danger overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </pre>
            )}
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" onClick={this.handleReset}>
                Try Again
              </Button>
              {this.props.fallbackAction && (
                <Button onClick={this.props.fallbackAction}>
                  Go to Overview
                </Button>
              )}
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
