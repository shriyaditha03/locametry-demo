import { NextResponse } from 'next/server'
import { searchGeocode } from '@/lib/nominatim'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q) {
        return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    try {
        const results = await searchGeocode(q)
        return NextResponse.json(results)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
