-- .NET lab: switch from code-server iframe to built-in IDE + lab_server execute API
USE `ignito_experia`;

UPDATE `Labs`
SET
    `RuntimeType` = 'ide',
    `RuntimePort` = 8080,
    `ContainerApiEnabled` = 1,
    `ContainerApiPort` = 8080,
    `UpdatedDate` = CURRENT_TIMESTAMP
WHERE `LabCode` = 'dotnet-lab' AND `IsDeleted` = 0;
