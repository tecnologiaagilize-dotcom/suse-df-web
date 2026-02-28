import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("IRA-SUSI Global Error (Module 10.4.4):", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center border-l-4 border-red-600">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Ops! Erro Crítico.</h1>
            <p className="text-gray-600 mb-6 text-sm">
              O pipeline do IRA-SUSI encontrou uma instabilidade inesperada. 
              Sua segurança não foi comprometida, mas a interface precisa ser reiniciada.
            </p>
            
            {this.state.error && (
                <details className="text-left text-xs bg-gray-50 p-3 rounded mb-6 overflow-auto max-h-32 border border-gray-200 font-mono text-gray-500">
                    <summary className="cursor-pointer mb-1 font-bold">Detalhes Técnicos</summary>
                    {this.state.error.toString()}
                </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-bold uppercase tracking-wide shadow-md"
            >
              Reiniciar Sistema (Safe Mode)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
