-- =============================================================================
-- 027  PROPOSED (NOT APPLIED) - lab access & payment lookup indexes
-- =============================================================================
-- Status:   PROPOSAL. Do not run until it is approved. Nothing in the application
--           requires it: the code works without these indexes, only slower as the
--           tables grow. No column is added, removed or changed by part A.
-- Target:   database `ignito_experia` (student DB). Table names are written exactly
--           as the application spells them (live MySQL 8.4 on Linux is case-sensitive).
-- Engine:   MySQL 8.4 (live) / MariaDB 10.4 (local). Plain secondary indexes only.
-- Measured: EXPLAIN on the local schema (2026-11-23) shows type=ALL (full scan) for
--           all three queries below.
--
-- Apply:    review, then run in a maintenance window; on InnoDB these are online
--           (ALGORITHM=INPLACE, LOCK=NONE) secondary-index builds.
-- Rollback: see the bottom of this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A1. token_orders.RazorpayOrderId
-- Used by: PaymentSettlementService.settleOrder (every /payments/razorpay/verify,
--          /token-orders/:id/verify-payment and every Razorpay webhook) through
--          TokenOrderRepository.getOrderByRazorpayOrderId:
--            SELECT ... FROM token_orders WHERE RazorpayOrderId = ?
-- Before:  full table scan per payment confirmation.
-- After:   single index lookup.
-- -----------------------------------------------------------------------------
ALTER TABLE `token_orders`
  ADD INDEX `IDX_TokenOrders_RazorpayOrderId` (`RazorpayOrderId`),
  ALGORITHM = INPLACE, LOCK = NONE;

-- -----------------------------------------------------------------------------
-- A2. student_lab_token_transactions (StudentId, TransactionType, LabId)
-- Used by: StudentLabAccessService (GET /student/labs/access, lab start access check):
--            SELECT DISTINCT LabId FROM student_lab_token_transactions
--            WHERE StudentId = ? AND TransactionType = 'PURCHASE'
-- Before:  full scan. The existing IDX_TokenTx_StudentLab starts with TenantId, which
--          this query cannot use. The table gets a USAGE row per billed minute, so it
--          is the fastest-growing table in the schema.
-- After:   index range scan on the student's PURCHASE rows only.
-- -----------------------------------------------------------------------------
ALTER TABLE `student_lab_token_transactions`
  ADD INDEX `IDX_TokenTx_Student_Type_Lab` (`StudentId`, `TransactionType`, `LabId`),
  ALGORITHM = INPLACE, LOCK = NONE;

-- -----------------------------------------------------------------------------
-- A3. course_lab_mappings (course_code, status, tenant_id)  [low priority]
-- Used by: StudentLabAccessService / LmsCourseLabService:
--            WHERE (tenant_id = ? OR tenant_id = 'PLATFORM') AND status = 'active'
--              AND course_code IN (...)
-- Before:  full scan (uk_tenant_course_lab leads with tenant_id, program_id, semester_id).
--          Today the table has 8 rows locally, so the gain is small; it matters once
--          many universities map their courses.
-- -----------------------------------------------------------------------------
ALTER TABLE `course_lab_mappings`
  ADD INDEX `idx_clm_course_status_tenant` (`course_code`, `status`, `tenant_id`),
  ALGORITHM = INPLACE, LOCK = NONE;

-- =============================================================================
-- B. SCHEMA ALIGNMENT - SEPARATE APPROVAL REQUIRED (left commented out on purpose)
-- =============================================================================
-- token_orders.Status has different ENUM lists per environment:
--   local MariaDB : ('PENDING','PAYMENT_PROCESSING','PAID','FAILED','CANCELLED')
--   migration 014 : ('CREATED','PAYMENT_PENDING','PAID','FAILED','EXPIRED','CANCELLED','REFUNDED')
--   migration 016 : ('PENDING_PAYMENT','PAID','TOKEN_CREDITED','FAILED','EXPIRED')
-- The code now reads the live ENUM and writes only values it contains
-- (TokenOrderRepository.pickStatus), so no change is needed for correctness.
-- If a single list is wanted everywhere, this superset keeps every existing value:
--
-- ALTER TABLE `token_orders`
--   MODIFY `Status` ENUM('CREATED','PENDING','PENDING_PAYMENT','PAYMENT_PENDING',
--                        'PAYMENT_PROCESSING','PAID','TOKEN_CREDITED','FAILED',
--                        'EXPIRED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING';
--
-- Before running B, check the live list with:
--   SELECT COLUMN_TYPE FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = 'ignito_experia' AND TABLE_NAME = 'token_orders' AND COLUMN_NAME = 'Status';
-- and confirm no row holds '' (written by non-strict MariaDB):
--   SELECT Id, OrderNumber FROM `token_orders` WHERE Status = '';

-- =============================================================================
-- ROLLBACK (part A)
-- =============================================================================
-- ALTER TABLE `token_orders` DROP INDEX `IDX_TokenOrders_RazorpayOrderId`;
-- ALTER TABLE `student_lab_token_transactions` DROP INDEX `IDX_TokenTx_Student_Type_Lab`;
-- ALTER TABLE `course_lab_mappings` DROP INDEX `idx_clm_course_status_tenant`;
-- Part B rollback: MODIFY `Status` back to the exact COLUMN_TYPE recorded before applying.
