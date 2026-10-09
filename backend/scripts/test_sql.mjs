import pool from '../lib/mysql.js';

async function test() {
  await pool.query('CREATE TEMPORARY TABLE test_wallets (Id INT AUTO_INCREMENT PRIMARY KEY, LabId VARCHAR(50) UNIQUE, TotalPurchasedTokens INT, ConsumedTokens INT, RemainingTokens INT)');
  await pool.query('INSERT INTO test_wallets (LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens) VALUES (?, ?, ?, ?)', ['test', 60, 0, 60]);
  
  await pool.query(`
    INSERT INTO test_wallets (LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens)
    VALUES ('test', 90, 0, 90)
    ON DUPLICATE KEY UPDATE
      TotalPurchasedTokens = IF(TotalPurchasedTokens < VALUES(TotalPurchasedTokens), VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
      RemainingTokens = CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) ELSE 0 END
  `);
  
  const [rows] = await pool.query('SELECT * FROM test_wallets');
  console.log('Test result:', rows);
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
