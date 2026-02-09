import { NextResponse } from 'next/server'
import { reverseGeocode } from '@/lib/nominatim'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!lat || !lng) {
        return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 })
    }

    try {
        const result = await reverseGeocode(parseFloat(lat), parseFloat(lng))
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
