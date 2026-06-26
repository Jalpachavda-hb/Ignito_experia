USE `ignito_experia`;

-- Used by AnalyticsCronService to store precomputed daily metrics

CREATE TABLE IF NOT EXISTS `Analytics_DailySummary` (
    `SummaryDate` DATE NOT NULL,
    `UniversityId` INT NOT NULL DEFAULT 0, -- 0 implies GLOBAL roll-up
    `TotalLogins` INT DEFAULT 0,
    `UniqueActiveUsers` INT DEFAULT 0,
    `FailedLogins` INT DEFAULT 0,
    `LabsStarted` INT DEFAULT 0,
    `LabsCompleted` INT DEFAULT 0,
    `AvgSessionDurationMinutes` INT DEFAULT 0,
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`SummaryDate`, `UniversityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Analytics_MonthlySummary` (
    `SummaryMonth` VARCHAR(7) NOT NULL, -- Format YYYY-MM
    `UniversityId` INT NOT NULL DEFAULT 0,
    `TotalLogins` INT DEFAULT 0,
    `UniqueActiveUsers` INT DEFAULT 0,
    `FailedLogins` INT DEFAULT 0,
    `LabsStarted` INT DEFAULT 0,
    `LabsCompleted` INT DEFAULT 0,
    `CreatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`SummaryMonth`, `UniversityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Analytics_DeviceSummary` (
    `SummaryDate` DATE NOT NULL,
    `Platform` VARCHAR(100) NOT NULL, -- e.g., 'Chrome', 'Windows'
    `PlatformType` ENUM('BROWSER', 'OS') NOT NULL,
    `SessionCount` INT DEFAULT 0,
    PRIMARY KEY (`SummaryDate`, `Platform`, `PlatformType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
