
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearCache() {
    try {
        console.log('Clearing GeoCache...');
        await prisma.geoCache.deleteMany({});
        console.log('GeoCache cleared successfully.');
    } catch (error) {
        console.error('Error clearing GeoCache:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearCache();
