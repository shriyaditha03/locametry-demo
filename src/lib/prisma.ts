import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

export const getPrisma = async () => {
  try {
    await prisma.$connect()
    return prisma
  } catch (error) {
    console.error('Database connection failed, falling back to read-only mode:', error)
    return null
  }
}
