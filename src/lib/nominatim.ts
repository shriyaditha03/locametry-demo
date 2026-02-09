import { getPrisma } from './prisma'

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'LocaMetry/1.0 (https://github.com/your-repo/locametry)'

// Rate limiting: 1 request per second
let lastRequestTime = 0
const RATE_LIMIT_MS = 1000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function rateLimit() {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        await wait(RATE_LIMIT_MS - timeSinceLastRequest)
    }
    lastRequestTime = Date.now()
}

export async function reverseGeocode(lat: number, lng: number) {
    const roundedLat = parseFloat(lat.toFixed(5))
    const roundedLng = parseFloat(lng.toFixed(5))

    const prisma = await getPrisma()

    // Try cache first
    if (prisma) {
        try {
            const cached = await prisma.geoCache.findUnique({
                where: {
                    latitude_longitude: {
                        latitude: roundedLat,
                        longitude: roundedLng,
                    },
                },
            })
            if (cached) {
                return {
                    display_name: cached.formattedAddress,
                    address: cached.address,
                    geojson: cached.geojson,
                    lat: cached.latitude,
                    lon: cached.longitude
                }
            }
        } catch (e) {
            console.warn('Cache lookup failed:', e)
        }
    }

    // Rate limit before external call
    await rateLimit()

    const response = await fetch(
        `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&polygon_geojson=1`,
        {
            headers: {
                'User-Agent': USER_AGENT,
            },
        }
    )

    if (!response.ok) {
        throw new Error('Nominatim reverse geocoding failed')
    }

    const data = await response.json()

    // Cache response if possible
    if (prisma && data && data.address) {
        try {
            await prisma.geoCache.create({
                data: {
                    latitude: roundedLat,
                    longitude: roundedLng,
                    formattedAddress: data.display_name || '',
                    address: data.address,
                    geojson: data.geojson || null,
                },
            })
        } catch (e) {
            console.warn('Failed to cache geocoding result:', e)
        }
    }

    return data
}

export async function searchGeocode(query: string) {
    // Rate limit before external call
    await rateLimit()

    const response = await fetch(
        `${NOMINATIM_BASE_URL}/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=1&polygon_geojson=1`,
        {
            headers: {
                'User-Agent': USER_AGENT,
            },
        }
    )

    if (!response.ok) {
        throw new Error('Nominatim search geocoding failed')
    }

    return await response.json()
}
