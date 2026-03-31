const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const roles = await prisma.role.findMany();
    console.log('ALL ROLES IN DB:');
    roles.forEach(r => console.log(`- "${r.name}" (ID: ${r.id})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
