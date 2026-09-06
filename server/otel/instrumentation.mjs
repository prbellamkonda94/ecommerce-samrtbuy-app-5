// Loaded via `node --import ./server/otel/instrumentation.mjs`, before any other
// module in the process, so OpenTelemetry can patch http/express/fetch before
// they're first required.
//
// This is a complete no-op unless OTEL_ENABLED=true is set: the heavy SDK
// packages aren't even imported otherwise, so local dev and the e2e/security
// test suites are unaffected by default.
import 'dotenv/config';

if (process.env.OTEL_ENABLED === 'true') {
  const [
    { NodeSDK },
    { getNodeAutoInstrumentations },
    { OTLPTraceExporter },
    { OTLPMetricExporter },
    { OTLPLogExporter },
    { PeriodicExportingMetricReader },
    { BatchLogRecordProcessor },
    { resourceFromAttributes },
    { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION },
  ] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/auto-instrumentations-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/exporter-metrics-otlp-http'),
    import('@opentelemetry/exporter-logs-otlp-http'),
    import('@opentelemetry/sdk-metrics'),
    import('@opentelemetry/sdk-logs'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
  ]);

  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318').replace(/\/+$/, '');

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'smartbuy-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 5000,
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }) }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Instrumenting every fs call is extremely noisy and rarely useful
        // for an API server; keep http/express/undici (fetch) instrumented.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk
      .shutdown()
      .catch((err) => console.error('[otel] error shutting down', err))
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log(`[otel] telemetry enabled -> ${endpoint}`);
}
