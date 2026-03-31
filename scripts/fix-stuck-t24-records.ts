import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStuckRecords() {
  console.log('Finding records falsely marked as forwarded...');
  
  // Find all records that are marked as forwarded
  const records = await prisma.customerOnboarding.findMany({
    where: {
      forwardedAt: { not: null },
      approvalStatus: 'APPROVED'
    },
    include: {
      auditLogs: true
    }
  });

  let fixedCount = 0;

  for (const record of records) {
    // Check the last forward audit log
    const forwardLog = record.auditLogs.find(log => log.action === 'FORWARDED');
    if (forwardLog && forwardLog.details?.includes('"status": "Failed"')) {
      console.log(`Fixing stuck record: ${record.mnemonic}`);
      
      // Extract the error message from the detail string for context
      const match = forwardLog.details.match(/"error"\s*:\s*"([^"]+)"/);
      const errorContext = match ? match[1] : 'Unknown T24 Error - previously falsely marked as successful';

      await prisma.customerOnboarding.update({
        where: { id: record.id },
        data: {
          forwardedAt: null,
          forwardError: `T24 Business Logic Failed: ${errorContext}`
        }
      });
      fixedCount++;
    }
  }

  console.log(`\nFixed ${fixedCount} records! You can now retry them in the UI.`);
  await prisma.$disconnect();
}

fixStuckRecords().catch(console.error);
