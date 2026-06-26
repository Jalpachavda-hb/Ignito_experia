export const auditPolicy = {
  // Retention Policy in days (e.g. 30, 90, 180, 365). Use null for Unlimited
  RetentionDays: 90,
  
  // Archiving config: Number of records to move in a single batch to avoid locking
  ArchiveBatchSize: 5000,
  
  // Asynchronous queue behavior
  EventEmitterMaxListeners: 100
};

export default auditPolicy;
