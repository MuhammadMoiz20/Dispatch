/*
  Lightweight OpenTelemetry initializer with safe fallbacks.
  - Uses NodeSDK and auto-instrumentations when dependencies are available
  - Exports a no-op if OpenTelemetry packages are missing
  Configure via env:
    OTEL_EXPORTER_OTLP_ENDPOINT (or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
    OTEL_SERVICE_NAME (overrides passed serviceName)
*/

export function initTelemetry(serviceName?: string) {
  // Delay require so consumers without deps don’t crash at import time
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resource } = require('@opentelemetry/resources');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME || serviceName || 'dispatch-service',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    const traceExporter = new OTLPTraceExporter();

    const sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start().catch(() => {
      // Swallow startup errors to avoid crashing services in dev/local
    });

    // Graceful shutdown in local/dev
    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
    process.on('SIGINT', () => {
      sdk
        .shutdown()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
  } catch (e) {
    // OpenTelemetry packages not installed; run without telemetry
  }
}
