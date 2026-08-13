-- ============================================================
-- Ignito Experia Owner Platform Migration 005: LMS Provider Configuration
-- Database: ignito_experia (Owner Database)
-- ============================================================

USE `ignito_experia`;

CREATE TABLE IF NOT EXISTS `tenant_student_auth_config` (
  `ConfigId` INT AUTO_INCREMENT PRIMARY KEY,
  `TenantId` VARCHAR(64) NOT NULL,
  `ProviderType` ENUM('OIDC', 'SAML', 'CUSTOM_SSO') NOT NULL DEFAULT 'OIDC',
  `ProviderName` VARCHAR(100) NOT NULL,
  `IssuerUrl` VARCHAR(255) NULL,
  `ClientId` VARCHAR(255) NULL,
  `EncryptedClientSecret` TEXT NULL,
  `AuthorizationUrl` VARCHAR(255) NULL,
  `TokenUrl` VARCHAR(255) NULL,
  `UserInfoUrl` VARCHAR(255) NULL,
  `Scopes` VARCHAR(255) DEFAULT 'openid profile email',
  `ConfigurationJson` JSON NULL,
  `Status` VARCHAR(50) DEFAULT 'ACTIVE',
  `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_tenant_provider_unique` (`TenantId`, `ProviderName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
