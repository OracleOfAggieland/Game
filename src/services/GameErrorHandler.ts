export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  roomId?: string;
}

export interface ErrorResult {
  success: boolean;
  fallbackMode?: boolean;
  message?: string;
}

export class GameErrorHandler {
  private static errorReportingEnabled = false;
  private static errorQueue: Array<{ error: Error; context: ErrorContext; timestamp: string }> = [];

  static handleFirebaseError(error: Error, context: ErrorContext): ErrorResult {
    const errorInfo = {
      error,
      context,
      timestamp: new Date().toISOString()
    };

    console.error(`Firebase ${context.operation} failed:`, {
      error: error.message,
      context,
      timestamp: errorInfo.timestamp
    });

    // Queue error for potential reporting
    this.queueError(errorInfo);

    return {
      success: false,
      fallbackMode: true,
      message: `Connection issue during ${context.operation}. Switching to offline mode.`
    };
  }

  private static queueError(errorInfo: { error: Error; context: ErrorContext; timestamp: string }): void {
    this.errorQueue.push(errorInfo);
    
    // Keep only recent errors
    if (this.errorQueue.length > 50) {
      this.errorQueue.shift();
    }

    // Report errors if enabled
    if (this.errorReportingEnabled) {
      this.reportError(errorInfo);
    }
  }

  private static reportError(errorInfo: { error: Error; context: ErrorContext; timestamp: string }): void {
    // This could integrate with services like Sentry, LogRocket, etc.
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Error queued for reporting:', errorInfo);
    }
  }

  static enableErrorReporting(): void {
    this.errorReportingEnabled = true;
  }

  static getErrorQueue(): Array<{ error: Error; context: ErrorContext; timestamp: string }> {
    return [...this.errorQueue];
  }

  static clearErrorQueue(): void {
    this.errorQueue.length = 0;
  }

  static handleGameStateError(error: Error, context: ErrorContext): ErrorResult {
    console.warn(`Game state issue in ${context.operation}:`, {
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      message: `Game state error: ${error.message}`
    };
  }

  static handleAIError(error: Error, context: ErrorContext): ErrorResult {
    console.warn(`AI calculation error:`, {
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      message: 'AI player encountered an error and will use fallback behavior'
    };
  }

  static handlePerformanceError(error: Error, context: ErrorContext): ErrorResult {
    console.warn(`Performance optimization error:`, {
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      message: 'Performance optimization failed, continuing with standard settings'
    };
  }
}