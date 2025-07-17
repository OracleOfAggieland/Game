// src/components/ErrorBoundaries/GameErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  featureName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary for game features
 */
export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error
    console.error(`Game Error Boundary (${this.props.featureName || 'Unknown'}):`, error, errorInfo);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // This would integrate with error reporting services like Sentry
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        featureName: this.props.featureName,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Store in localStorage for debugging
      const existingErrors = JSON.parse(localStorage.getItem('gameErrors') || '[]');
      existingErrors.push(errorReport);
      
      // Keep only last 10 errors
      if (existingErrors.length > 10) {
        existingErrors.shift();
      }
      
      localStorage.setItem('gameErrors', JSON.stringify(existingErrors));
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>🎮 Game Feature Error</h2>
            <p>
              {this.props.featureName ? 
                `The ${this.props.featureName} feature encountered an error.` :
                'A game feature encountered an error.'
              }
            </p>
            <p>The game will continue to work, but this feature may be disabled.</p>
            
            <div className="error-actions">
              <button onClick={this.handleRetry} className="retry-button">
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="reload-button"
              >
                Reload Game
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <pre className="error-stack">
                  {this.state.error?.stack}
                </pre>
                <pre className="error-component-stack">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Power-up system error boundary
 */
export const PowerUpErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <GameErrorBoundary
    featureName="Power-up System"
    fallback={
      <div className="feature-disabled-notice">
        <p>⚡ Power-ups are temporarily disabled due to an error.</p>
        <p>The game will continue without power-ups.</p>
      </div>
    }
    onError={(error) => {
      console.warn('Power-up system disabled due to error:', error);
      // Could disable power-up spawning here
    }}
  >
    {children}
  </GameErrorBoundary>
);

/**
 * Wave system error boundary
 */
export const WaveErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <GameErrorBoundary
    featureName="Wave System"
    fallback={
      <div className="feature-disabled-notice">
        <p>🌊 Wave progression is temporarily disabled due to an error.</p>
        <p>The game will continue in standard mode.</p>
      </div>
    }
    onError={(error) => {
      console.warn('Wave system disabled due to error:', error);
      // Could disable wave progression here
    }}
  >
    {children}
  </GameErrorBoundary>
);

/**
 * Visual effects error boundary
 */
export const EffectsErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <GameErrorBoundary
    featureName="Visual Effects"
    fallback={null} // Silently disable effects
    onError={(error) => {
      console.warn('Visual effects disabled due to error:', error);
      // Could disable particle system, animations, etc.
    }}
  >
    {children}
  </GameErrorBoundary>
);

/**
 * Sound effects error boundary
 */
export const SoundErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <GameErrorBoundary
    featureName="Sound Effects"
    fallback={null} // Silently disable sounds
    onError={(error) => {
      console.warn('Sound effects disabled due to error:', error);
      // Could disable sound system
    }}
  >
    {children}
  </GameErrorBoundary>
);

/**
 * Performance features error boundary
 */
export const PerformanceErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <GameErrorBoundary
    featureName="Performance Optimizations"
    fallback={null} // Continue without optimizations
    onError={(error) => {
      console.warn('Performance optimizations disabled due to error:', error);
      // Could fall back to basic rendering
    }}
  >
    {children}
  </GameErrorBoundary>
);

export default GameErrorBoundary;