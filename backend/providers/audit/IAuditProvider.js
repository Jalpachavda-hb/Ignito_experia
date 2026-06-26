/**
 * Abstract Interface for Audit Providers.
 * Implementing classes should handle the ingestion mechanism of audit logs
 * (e.g. EventEmitter, SQS, RabbitMQ, Kafka).
 */
export class IAuditProvider {
  /**
   * Enqueue an audit event to be processed.
   * @param {Object} eventPayload - The structured audit log payload
   */
  async emitEvent(eventPayload) {
    throw new Error("Method 'emitEvent()' must be implemented.");
  }
}
