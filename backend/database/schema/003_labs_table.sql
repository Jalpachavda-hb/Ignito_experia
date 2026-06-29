CREATE TABLE IF NOT EXISTS `labs` (
    `LabId` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `TenantId` BIGINT NULL  ,
    `LabCode` VARCHAR(100) NOT NULL UNIQUE,
    `Title` VARCHAR(200) NOT NULL,
    `Subtitle` VARCHAR(300),
    `Semester` VARCHAR(100),
    `Logo` VARCHAR(255)  ,
    `DurationMinutes` INT DEFAULT 0,
    `Credits` INT DEFAULT 0,
    `Complexity` VARCHAR(50),
    `Category` VARCHAR(100),
    `Description` LONGTEXT,
    `TaskDefinition` VARCHAR(200),
    
    `RuntimeType` ENUM('ide', 'terminal', 'jupyter', 'codeserver'),
    `RuntimePort` INT,
    `RuntimePath` VARCHAR(200),
    
    `ContainerApiEnabled` TINYINT(1) DEFAULT 0,
    `ContainerApiPort` INT,
    
    `DisplayOrder` INT DEFAULT 0,
    `Status` VARCHAR(20) NOT NULL DEFAULT 'active' ,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    
    `CreatedBy` BIGINT NULL,
    `UpdatedBy` BIGINT NULL,
    `CreatedDate` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `UpdatedDate` DATETIME NULL,

    INDEX `IDX_labs_LabCode` (`LabCode`),
    INDEX `IDX_labs_RuntimeType` (`RuntimeType`),
    INDEX `IDX_labs_Status` (`Status`),
    INDEX `IDX_labs_Category` (`Category`),
    INDEX `IDX_labs_TenantId` (`TenantId`),
    INDEX `IDX_labs_IsDeleted` (`IsDeleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ;
