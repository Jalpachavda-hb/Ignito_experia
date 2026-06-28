DELIMITER //

DROP PROCEDURE IF EXISTS `sp_User_GetAll` //

CREATE PROCEDURE `sp_User_GetAll` (
    IN p_Page INT,
    IN p_PageSize INT,
    IN p_Search VARCHAR(255),
    IN p_Role VARCHAR(50),
    IN p_Status VARCHAR(50),
    IN p_ProgramId INT,
    IN p_SemesterId INT,
    IN p_SortBy VARCHAR(50),
    IN p_SortOrder VARCHAR(4)
)
BEGIN
    DECLARE v_Offset INT;
    SET v_Offset = (p_Page - 1) * p_PageSize;
    
    -- Main query with pagination and total count calculation
    SELECT 
        u.UserId, 
        u.FullName, 
        u.Email, 
        u.PhoneNumber,
        r.Name AS Role, 
        u.Status, 
        NULL AS EnrollmentNumber,
        NULL AS ProgramId, 
        NULL AS SemesterId, 
        COALESCE(w.Balance, 0) AS CreditBalance,
        u.LastLoginAt, 
        u.CreatedAt,
        COUNT(*) OVER() AS TotalRecords
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.RoleId
    LEFT JOIN StudentCreditWallets w ON u.UserId = w.UserId
    WHERE COALESCE(u.IsDeleted, 0) = 0
      AND (p_Search IS NULL OR p_Search = '' 
           OR u.FullName COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_Search, '%') COLLATE utf8mb4_unicode_ci 
           OR u.Email COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_Search, '%') COLLATE utf8mb4_unicode_ci 
           OR u.PhoneNumber COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_Search, '%') COLLATE utf8mb4_unicode_ci)
      AND (p_Role IS NULL OR p_Role = '' OR r.Name COLLATE utf8mb4_unicode_ci = p_Role COLLATE utf8mb4_unicode_ci)
      AND (p_Status IS NULL OR p_Status = '' OR u.Status COLLATE utf8mb4_unicode_ci = p_Status COLLATE utf8mb4_unicode_ci)
      -- ProgramId and SemesterId filtering removed as they are managed via LMS/cookies
    ORDER BY 
        CASE WHEN p_SortBy = 'Name' AND p_SortOrder = 'asc' THEN u.FullName END ASC,
        CASE WHEN p_SortBy = 'Name' AND p_SortOrder = 'desc' THEN u.FullName END DESC,
        CASE WHEN p_SortBy = 'Email' AND p_SortOrder = 'asc' THEN u.Email END ASC,
        CASE WHEN p_SortBy = 'Email' AND p_SortOrder = 'desc' THEN u.Email END DESC,
        CASE WHEN p_SortBy = 'Role' AND p_SortOrder = 'asc' THEN r.Name END ASC,
        CASE WHEN p_SortBy = 'Role' AND p_SortOrder = 'desc' THEN r.Name END DESC,
        CASE WHEN p_SortBy = 'Status' AND p_SortOrder = 'asc' THEN u.Status END ASC,
        CASE WHEN p_SortBy = 'Status' AND p_SortOrder = 'desc' THEN u.Status END DESC,
        CASE WHEN p_SortBy = 'CreatedAt' AND p_SortOrder = 'asc' THEN u.CreatedAt END ASC,
        CASE WHEN p_SortBy = 'CreatedAt' AND p_SortOrder = 'desc' THEN u.CreatedAt END DESC,
        u.UserId DESC
    LIMIT p_PageSize OFFSET v_Offset;
END //

DELIMITER ;
