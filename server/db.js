import { neon } from '@neondatabase/serverless';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.'
  );
}

const rawSql = neon(process.env.DATABASE_URL);
const tracer = trace.getTracer('smartbuy-db');

// The Neon serverless driver talks over HTTP/fetch rather than a normal `pg`
// socket, so generic http/undici auto-instrumentation only sees a POST to
// Neon's endpoint -- it can't tell a SELECT from an INSERT. Wrapping the
// tagged-template call site here gives each query its own span with real
// db.statement/db.operation attributes, while every call site elsewhere in
// the app keeps using `sql\`...\`` exactly as before.
export function sql(strings, ...values) {
  const text = strings.join('?').trim().replace(/\s+/g, ' ');
  const operation = text.split(' ')[0]?.toUpperCase() || 'QUERY';

  return tracer.startActiveSpan(
    `db.${operation}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.operation': operation,
        'db.statement': text,
      },
    },
    (span) =>
      rawSql(strings, ...values)
        .then((result) => {
          if (Array.isArray(result)) span.setAttribute('db.rows_affected', result.length);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        })
        .catch((err) => {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          throw err;
        })
        .finally(() => span.end())
  );
}
