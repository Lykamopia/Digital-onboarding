const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const roles = await prisma.role.findMany();
    console.log('Roles:', JSON.stringify(roles, null, 2));
    
    // Find legacy roles
    const legacyRoles = roles.filter(r => r.name.toLowerCase().includes('legacy'));
    
    if (legacyRoles.length > 0) {
        console.log('Removing legacy roles:', legacyRoles.map(r => r.name));
        
        // Check if any users are assigned to these roles
        const usersInLegacyRoles = await prisma.user.findMany({
            where: { roleId: { in: legacyRoles.map(r => r.id) } }
        });
        
        if (usersInLegacyRoles.length > 0) {
            console.log('Moving users to default roles...');
            // Find 'Maker (Onboarding)' or 'Checker (Onboarding)' or just 'Member'
            const defaultMaker = roles.find(r => r.name === 'Maker (Onboarding)');
            const defaultChecker = roles.find(r => r.name === 'Checker (Onboarding)');
            
            for (const user of usersInLegacyRoles) {
                const userRole = roles.find(r => r.id === user.roleId);
                let targetRoleId = null;
                if (userRole.name.includes('Maker')) {
                    targetRoleId = defaultMaker?.id;
                } else if (userRole.name.includes('Checker')) {
                    targetRoleId = defaultChecker?.id;
                }
                
                if (targetRoleId) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { roleId: targetRoleId }
                    });
                }
            }
        }
        
        // Delete the roles
        await prisma.role.deleteMany({
            where: { id: { in: legacyRoles.map(r => r.id) } }
        });
        console.log('Legacy roles removed successfully.');
    } else {
        console.log('No legacy roles found.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
