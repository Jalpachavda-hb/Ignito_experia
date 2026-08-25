class NotificationService {
  constructor() {
    this.listeners = new Set();
  }

  onNotification(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event, payload) {
    console.log(`[NotificationService] Event '${event}' for User ${payload.userId || payload.studentId}:`, payload);
    for (const listener of this.listeners) {
      try {
        listener(event, payload);
      } catch (err) {
        console.error(`[NotificationService] Error in listener for event ${event}:`, err.message);
      }
    }
  }

  emitBalanceUpdated(studentIdOrPayload, labId, remainingTokens, usedTokens) {
    if (typeof studentIdOrPayload === 'object' && studentIdOrPayload !== null) {
      const p = studentIdOrPayload;
      this.emit("TOKEN_BALANCE_UPDATED", {
        studentId: String(p.studentId || p.userId),
        labId: p.labId,
        remainingTokens: p.remainingTokens,
        usedTokens: p.usedTokens,
        timestamp: new Date().toISOString()
      });
      return;
    }
    this.emit("TOKEN_BALANCE_UPDATED", {
      studentId: String(studentIdOrPayload),
      labId,
      remainingTokens,
      usedTokens,
      timestamp: new Date().toISOString()
    });
  }

  emitLowBalanceWarning(studentIdOrPayload, labId, remainingTokens) {
    if (typeof studentIdOrPayload === 'object' && studentIdOrPayload !== null) {
      const p = studentIdOrPayload;
      this.emit("TOKEN_WARNING_LOW", {
        studentId: String(p.studentId || p.userId),
        labId: p.labId,
        remainingTokens: p.remainingTokens,
        message: `You have only ${p.remainingTokens} minute(s) remaining for this lab. Purchase additional tokens to continue without interruption.`,
        timestamp: new Date().toISOString()
      });
      return;
    }
    this.emit("TOKEN_WARNING_LOW", {
      studentId: String(studentIdOrPayload),
      labId,
      remainingTokens,
      message: `You have only ${remainingTokens} minute(s) remaining for this lab. Purchase additional tokens to continue without interruption.`,
      timestamp: new Date().toISOString()
    });
  }

  emitTokenExhausted(studentIdOrPayload, labId, sessionId) {
    if (typeof studentIdOrPayload === 'object' && studentIdOrPayload !== null) {
      const p = studentIdOrPayload;
      this.emit("TOKEN_EXHAUSTED", {
        studentId: String(p.studentId || p.userId),
        labId: p.labId,
        sessionId: p.sessionId,
        message: `Your available lab tokens have been fully used. The lab session has been stopped automatically.`,
        timestamp: new Date().toISOString()
      });
      return;
    }
    this.emit("TOKEN_EXHAUSTED", {
      studentId: String(studentIdOrPayload),
      labId,
      sessionId,
      message: `Your available lab tokens have been fully used. The lab session has been stopped automatically.`,
      timestamp: new Date().toISOString()
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
