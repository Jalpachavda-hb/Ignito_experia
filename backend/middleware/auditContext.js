import crypto from "crypto";

/**
 * Middleware to generate and attach CorrelationId and RequestId
 * to the request object so services can seamlessly access them.
 * 
 * If running via API Gateway, req.apiGateway.event might be used
 * instead of standard Express res/req. For flexibility, we attach
 * it directly to the Express `req` and AWS `event.requestContext`.
 */
export const auditContextMiddleware = (req, res, next) => {
  // Generate robust traceability IDs
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  // Standard express mutation
  req.correlationId = correlationId;
  req.requestId = requestId;

  // AWS Event mutation if present (from aws-serverless-express/vendia)
  if (req.apiGateway && req.apiGateway.event) {
    req.apiGateway.event.correlationId = correlationId;
    req.apiGateway.event.requestId = requestId;
  }

  // Ensure downstream services return the ID to the client
  res.setHeader('X-Correlation-ID', correlationId);

  next();
};

export default auditContextMiddleware;
