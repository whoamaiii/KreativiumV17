/* eslint-disable no-restricted-syntax */
// Vite builds this as a module worker (see vite.config.ts worker.format = 'es')
import { exportSystem as ExportSystem } from '@/lib/exportSystem';

export type ReportsWorkerRequest = {
  id: string;
  kind: 'csv' | 'json';
  payload: {
    students: unknown[];
    allData: {
      trackingEntries: unknown[];
      emotions: unknown[];
      sensoryInputs: unknown[];
      goals: unknown[];
    };
    options: {
      format: 'csv' | 'json';
      includeFields: string[];
      dateRange?: { start: string; end: string } | null;
      anonymize?: boolean;
    };
  };
};

export type ReportsWorkerResponse =
  | { id: string; type: 'progress'; progress: number; message?: string }
  | { id: string; type: 'success'; content: string; kind: 'csv' | 'json' }
  | { id: string; type: 'error'; error: string };

self.addEventListener('message', (evt: MessageEvent<ReportsWorkerRequest>) => {
  const msg = evt.data;
  const respond = (data: ReportsWorkerResponse) => (self as unknown as Worker).postMessage(data);

  try {
    respond({ id: msg.id, type: 'progress', progress: 0.05, message: 'starting' });

    const { students, allData, options } = msg.payload;

    // Progress hint: filtering window
    respond({ id: msg.id, type: 'progress', progress: 0.2, message: 'preparing' });

    let content = '';
    if (msg.kind === 'csv') {
      content = ExportSystem.generateCSVExport(students as any[], allData as any, {
        ...(options as any),
        dateRange: options.dateRange
          ? { start: new Date(options.dateRange.start), end: new Date(options.dateRange.end) }
          : undefined,
      });
    } else if (msg.kind === 'json') {
      content = ExportSystem.generateJSONExport(students as any[], allData as any, {
        ...(options as any),
        dateRange: options.dateRange
          ? { start: new Date(options.dateRange.start), end: new Date(options.dateRange.end) }
          : undefined,
      });
    }

    respond({ id: msg.id, type: 'progress', progress: 0.95, message: 'finalizing' });
    respond({ id: msg.id, type: 'success', content, kind: msg.kind });
  } catch (e) {
    respond({ id: msg.id, type: 'error', error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
