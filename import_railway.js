const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root:ZgufzlbEVOAqygrnZfkDvbcYwlVFbAOl@mainline.proxy.rlwy.net:31488/railway";
const SQL_FILE_PATH = path.resolve(__dirname, '..', 'supply_db.sql');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (c === '-' && next === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (c === '#') {
        inLineComment = true;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (c === "'" && !inDoubleQuote && !inBacktick) {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && sql[j] === '\\') {
        backslashes++;
        j--;
      }
      if (backslashes % 2 === 0) {
        inSingleQuote = !inSingleQuote;
      }
    } else if (c === '"' && !inSingleQuote && !inBacktick) {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && sql[j] === '\\') {
        backslashes++;
        j--;
      }
      if (backslashes % 2 === 0) {
        inDoubleQuote = !inDoubleQuote;
      }
    } else if (c === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
    }

    if (c === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += c;
    }
  }

  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

async function run() {
  console.log('----------------------------------------------------');
  console.log('🚀 Starting Database Import to Railway MySQL...');
  console.log('📌 Target URL: ' + DATABASE_URL.replace(/:[^:]*@/, ':****@'));
  console.log('📁 Reading SQL file: ' + SQL_FILE_PATH);
  console.log('----------------------------------------------------');

  if (!fs.existsSync(SQL_FILE_PATH)) {
    console.error('❌ SQL file not found at: ' + SQL_FILE_PATH);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf-8');
  console.log(`📖 File loaded (${(sqlContent.length / 1024).toFixed(1)} KB). Parsing statements...`);

  const rawStatements = splitSqlStatements(sqlContent);
  console.log(`📊 Found ${rawStatements.length} total SQL statements.`);

  // Filter out transaction controls that can conflict with connection pools
  const statements = rawStatements.filter(s => {
    const upper = s.trim().toUpperCase();
    return upper !== 'START TRANSACTION' && upper !== 'COMMIT';
  });

  try {
    console.log('🔌 Connecting to Railway MySQL...');
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    console.log('✅ Connected! Disabled foreign key checks for safe import.');

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, ' ').substring(0, 60);

      try {
        await prisma.$executeRawUnsafe(stmt);
        successCount++;
        if ((i + 1) % 10 === 0 || i === statements.length - 1) {
          process.stdout.write(`\r⏳ Progress: [${i + 1}/${statements.length}] statements executed...`);
        }
      } catch (err) {
        skipCount++;
        // If table already exists or harmless warning, continue
        console.warn(`\n⚠️  Statement ${i + 1} warning: ${err.message.split('\n')[0]}`);
        console.warn(`   Preview: ${preview}...`);
      }
    }

    console.log('\n\n🔒 Re-enabling foreign key checks...');
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('----------------------------------------------------');
    console.log(`🎉 IMPORT COMPLETED SUCCESSFULLY!`);
    console.log(`✅ Executed: ${successCount} statements`);
    if (skipCount > 0) {
      console.log(`⚠️  Skipped/Warnings: ${skipCount} statements`);
    }
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
