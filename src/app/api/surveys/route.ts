import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { z } from 'zod'

const surveySchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    formattedAddress: z.string(),
    house_number: z.string().optional().default(''),
    road: z.string().optional().default(''),
    neighbourhood: z.string().optional().default(''),
    city: z.string().optional().default(''),
    town: z.string().optional().default(''),
    village: z.string().optional().default(''),
    county: z.string().optional().default(''),
    district: z.string().optional().default(''),
    state: z.string().optional().default(''),
    province: z.string().optional().default(''),
    postcode: z.string().optional().default(''),
    country: z.string().optional().default(''),
    mode: z.enum(['RECT3', 'FOUR', 'POLY']),
    points: z.array(z.object({ lat: z.number(), lng: z.number() })),
    length_m: z.number().optional().nullable(),
    length_ft: z.number().optional().nullable(),
    width_m: z.number().optional().nullable(),
    width_ft: z.number().optional().nullable(),
    area_sqm: z.number().optional().nullable(),
    area_sqft: z.number().optional().nullable(),
    perimeter_m: z.number().optional().nullable(),
    perimeter_ft: z.number().optional().nullable(),
})

export async function GET() {
    const prisma = await getPrisma()
    if (!prisma) {
        return NextResponse.json({ surveys: [], readOnly: true })
    }

    try {
        const surveys = await prisma.survey.findMany({
            orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json({ surveys, readOnly: false })
    } catch (error) {
        return NextResponse.json({ surveys: [], readOnly: true, error: 'Failed to fetch surveys' })
    }
}

export async function POST(request: Request) {
    const prisma = await getPrisma()
    if (!prisma) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    try {
        const body = await request.json()
        const validatedData = surveySchema.parse(body)

        const survey = await prisma.survey.create({
            data: {
                ...validatedData,
                points: validatedData.points as any, // Json type
            },
        })

        return NextResponse.json(survey)
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
