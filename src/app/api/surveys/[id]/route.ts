import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const prisma = await getPrisma()
    if (!prisma) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    try {
        const id = params.id
        await prisma.survey.delete({
            where: { id },
        })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
