
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'LocaMetry/1.0'

async function testReverse() {
    // Coordinates for a known place with a boundary (e.g., Central Park, NY or a building)
    // 40.7812, -73.9665 (Central Park)
    const lat = 40.7812
    const lng = -73.9665

    console.log('Testing Reverse Geocoding...')
    const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&polygon_geojson=1`
    console.log('URL:', url)

    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        const data = await res.json()
        console.log('Keys:', Object.keys(data))
        if (data.geojson) {
            console.log('GeoJSON type:', data.geojson.type)
        } else {
            console.log('No geojson field found!')
        }
    } catch (e) {
        console.error(e)
    }
}

testReverse()
