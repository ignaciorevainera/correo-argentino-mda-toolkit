import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex flex-col items-center justify-center gap-3 p-4 bg-base-100 text-base-content">
          <div className="text-error font-bold text-lg">Error inesperado</div>
          <pre className="text-xs font-mono text-base-content/70 whitespace-pre-wrap break-all max-w-full border border-base-300 rounded p-3 bg-base-200">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="btn btn-primary btn-sm"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
