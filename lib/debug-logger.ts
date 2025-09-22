// Debug Logger Service
// Provides comprehensive logging capabilities for the import/export system

import { supabase } from './supabase';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type LogCategory = 'IMPORT' | 'EXPORT' | 'VALIDATION' | 'DATABASE' | 'SYSTEM';

export interface LogContext {
  jobId?: string;
  userId?: string;
  module?: string;
  sessionId?: string;
  details?: any;
  stackTrace?: string;
  sourceFile?: string;
  sourceLine?: number;
}

export interface SystemMetric {
  name: string;
  value: number;
  type?: 'COUNTER' | 'GAUGE' | 'HISTOGRAM';
  tags?: Record<string, string>;
  module?: string;
}

export interface PerformanceSnapshot {
  type: 'IMPORT_JOB' | 'EXPORT_JOB' | 'SYSTEM_HEALTH';
  jobId?: string;
  metrics?: Record<string, any>;
  durationMs?: number;
  memoryUsageMb?: number;
  cpuUsagePercent?: number;
  rowsPerSecond?: number;
  errorRate?: number;
}

class DebugLogger {
  private static instance: DebugLogger;
  private sessionId: string;
  private isEnabled: boolean = true;
  private logQueue: Array<any> = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startPeriodicFlush();
  }

  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private startPeriodicFlush(): void {
    // Flush logs every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000);
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public async debug(message: string, category: LogCategory = 'SYSTEM', context?: LogContext): Promise<void> {
    return this.log('DEBUG', category, message, context);
  }

  public async info(message: string, category: LogCategory = 'SYSTEM', context?: LogContext): Promise<void> {
    return this.log('INFO', category, message, context);
  }

  public async warning(message: string, category: LogCategory = 'SYSTEM', context?: LogContext): Promise<void> {
    return this.log('WARNING', category, message, context);
  }

  public async error(message: string, category: LogCategory = 'SYSTEM', context?: LogContext): Promise<void> {
    return this.log('ERROR', category, message, context);
  }

  public async critical(message: string, category: LogCategory = 'SYSTEM', context?: LogContext): Promise<void> {
    return this.log('CRITICAL', category, message, context);
  }

  private async log(level: LogLevel, category: LogCategory, message: string, context?: LogContext): Promise<void> {
    if (!this.isEnabled) return;

    const logEntry = {
      level,
      category,
      message,
      details: context?.details ? JSON.stringify(context.details) : null,
      job_id: context?.jobId || null,
      user_id: context?.userId || null,
      module: context?.module || null,
      session_id: context?.sessionId || this.sessionId,
      stack_trace: context?.stackTrace || (level === 'ERROR' || level === 'CRITICAL' ? this.captureStackTrace() : null),
      source_file: context?.sourceFile || null,
      source_line: context?.sourceLine || null,
      created_at: new Date().toISOString()
    };

    // Add to queue for batch processing
    this.logQueue.push(logEntry);

    // For critical errors, flush immediately
    if (level === 'CRITICAL' || level === 'ERROR') {
      await this.flushLogs();
    }
  }

  private captureStackTrace(): string {
    const stack = new Error().stack;
    if (!stack) return '';
    
    // Remove the first few lines (this function and the log function)
    const lines = stack.split('\n').slice(3);
    return lines.join('\n');
  }

  private async flushLogs(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const logsToFlush = [...this.logQueue];
    this.logQueue = [];

    try {
      const { error } = await supabase
        .from('debug_logs')
        .insert(logsToFlush);

      if (error) {
        // If logging fails, add logs back to queue and try again later
        this.logQueue.unshift(...logsToFlush);
        console.error('Failed to flush debug logs:', error);
      }
    } catch (error) {
      // If logging fails, add logs back to queue
      this.logQueue.unshift(...logsToFlush);
      console.error('Failed to flush debug logs:', error);
    }
  }

  public async recordMetric(metric: SystemMetric): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await supabase
        .from('system_metrics')
        .insert([{
          metric_name: metric.name,
          metric_value: metric.value,
          metric_type: metric.type || 'GAUGE',
          tags: metric.tags ? JSON.stringify(metric.tags) : null,
          module: metric.module || null,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Failed to record metric:', error);
      }
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  public async recordPerformanceSnapshot(snapshot: PerformanceSnapshot): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await supabase
        .from('performance_snapshots')
        .insert([{
          snapshot_type: snapshot.type,
          job_id: snapshot.jobId || null,
          metrics: snapshot.metrics ? JSON.stringify(snapshot.metrics) : '{}',
          duration_ms: snapshot.durationMs || null,
          memory_usage_mb: snapshot.memoryUsageMb || null,
          cpu_usage_percent: snapshot.cpuUsagePercent || null,
          rows_per_second: snapshot.rowsPerSecond || null,
          error_rate: snapshot.errorRate || null,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Failed to record performance snapshot:', error);
      }
    } catch (error) {
      console.error('Failed to record performance snapshot:', error);
    }
  }

  // Helper methods for import/export operations
  public createJobLogger(jobId: string, module: string) {
    return {
      debug: (message: string, details?: any) => 
        this.debug(message, 'IMPORT', { jobId, module, details }),
      info: (message: string, details?: any) => 
        this.info(message, 'IMPORT', { jobId, module, details }),
      warning: (message: string, details?: any) => 
        this.warning(message, 'IMPORT', { jobId, module, details }),
      error: (message: string, details?: any) => 
        this.error(message, 'IMPORT', { jobId, module, details }),
      critical: (message: string, details?: any) => 
        this.critical(message, 'IMPORT', { jobId, module, details }),
      recordMetric: (name: string, value: number, type?: 'COUNTER' | 'GAUGE' | 'HISTOGRAM') =>
        this.recordMetric({ name, value, type, module, tags: { job_id: jobId } })
    };
  }

  public async logImportStart(jobId: string, module: string, totalRows: number): Promise<void> {
    await this.info(
      `Import job started: ${module}`,
      'IMPORT',
      { 
        jobId, 
        module, 
        details: { 
          total_rows: totalRows,
          action: 'import_start'
        } 
      }
    );
    
    await this.recordMetric({
      name: 'import_jobs_started',
      value: 1,
      type: 'COUNTER',
      module,
      tags: { job_id: jobId }
    });
  }

  public async logImportProgress(jobId: string, module: string, processed: number, total: number): Promise<void> {
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    await this.debug(
      `Import progress: ${processed}/${total} (${progress}%)`,
      'IMPORT',
      { 
        jobId, 
        module, 
        details: { 
          processed,
          total,
          progress_percent: progress,
          action: 'import_progress'
        } 
      }
    );

    await this.recordMetric({
      name: 'import_progress_percent',
      value: progress,
      type: 'GAUGE',
      module,
      tags: { job_id: jobId }
    });
  }

  public async logImportComplete(jobId: string, module: string, result: { processed: number; errors: number; duration: number }): Promise<void> {
    const success = result.errors === 0;
    const successRate = result.processed > 0 ? ((result.processed - result.errors) / result.processed) * 100 : 0;
    
    await this.info(
      `Import job completed: ${module} - ${result.processed} processed, ${result.errors} errors in ${result.duration}ms`,
      'IMPORT',
      { 
        jobId, 
        module, 
        details: { 
          ...result,
          success,
          success_rate: successRate,
          action: 'import_complete'
        } 
      }
    );

    // Record multiple metrics
    await Promise.all([
      this.recordMetric({
        name: 'import_jobs_completed',
        value: 1,
        type: 'COUNTER',
        module,
        tags: { job_id: jobId, success: success.toString() }
      }),
      this.recordMetric({
        name: 'import_records_processed',
        value: result.processed,
        type: 'COUNTER',
        module
      }),
      this.recordMetric({
        name: 'import_processing_time_ms',
        value: result.duration,
        type: 'HISTOGRAM',
        module
      }),
      this.recordMetric({
        name: 'import_success_rate',
        value: successRate,
        type: 'GAUGE',
        module
      })
    ]);

    // Record performance snapshot
    await this.recordPerformanceSnapshot({
      type: 'IMPORT_JOB',
      jobId,
      metrics: result,
      durationMs: result.duration,
      rowsPerSecond: result.duration > 0 ? (result.processed / result.duration) * 1000 : 0,
      errorRate: result.processed > 0 ? (result.errors / result.processed) * 100 : 0
    });
  }

  public async logImportError(jobId: string, module: string, error: Error | string, context?: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    await this.error(
      `Import error: ${errorMessage}`,
      'IMPORT',
      { 
        jobId, 
        module, 
        details: { 
          error_message: errorMessage,
          context,
          action: 'import_error'
        },
        stackTrace
      }
    );

    await this.recordMetric({
      name: 'import_errors',
      value: 1,
      type: 'COUNTER',
      module,
      tags: { job_id: jobId }
    });
  }

  // Cleanup method
  public async cleanup(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    await this.flushLogs();
  }
}

// Export singleton instance
export const debugLogger = DebugLogger.getInstance();

// Export helper functions
export const createJobLogger = (jobId: string, module: string) => debugLogger.createJobLogger(jobId, module);
export const logImportStart = (jobId: string, module: string, totalRows: number) => debugLogger.logImportStart(jobId, module, totalRows);
export const logImportProgress = (jobId: string, module: string, processed: number, total: number) => debugLogger.logImportProgress(jobId, module, processed, total);
export const logImportComplete = (jobId: string, module: string, result: { processed: number; errors: number; duration: number }) => debugLogger.logImportComplete(jobId, module, result);
export const logImportError = (jobId: string, module: string, error: Error | string, context?: any) => debugLogger.logImportError(jobId, module, error, context);