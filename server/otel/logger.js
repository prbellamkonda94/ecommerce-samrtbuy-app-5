// Structured logging that always prints to stdout (so `npm run dev` looks the
// same as before), and additionally emits through the @opentelemetry/api-logs
// facade. That facade is a safe no-op until a LoggerProvider is registered
// (see instrumentation.mjs), so this file behaves identically whether
// OTEL_ENABLED is set or not -- the only difference is whether records also
// ship to the collector. When they do, the OTel Logs SDK automatically stamps
// the active span's trace_id/span_id onto each record, which is what lets
// Grafana jump from a trace straight to its logs.
import { trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

const otelLogger = logs.getLogger('smartbuy-api');

function emit(severityNumber, severityText, message, attributes = {}) {
  const spanContext = trace.getActiveSpan()?.spanContext();

  const line = {
    time: new Date().toISOString(),
    level: severityText,
    msg: message,
    ...attributes,
    ...(spanContext ? { trace_id: spanContext.traceId, span_id: spanContext.spanId } : {}),
  };
  const serialized = JSON.stringify(line);
  if (severityNumber >= SeverityNumber.ERROR) console.error(serialized);
  else if (severityNumber >= SeverityNumber.WARN) console.warn(serialized);
  else console.log(serialized);

  otelLogger.emit({ severityNumber, severityText, body: message, attributes });
}

export const logger = {
  info: (message, attributes) => emit(SeverityNumber.INFO, 'INFO', message, attributes),
  warn: (message, attributes) => emit(SeverityNumber.WARN, 'WARN', message, attributes),
  error: (message, attributes) => emit(SeverityNumber.ERROR, 'ERROR', message, attributes),
};
