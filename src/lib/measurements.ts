import * as turf from '@turf/turf'

export interface Point {
    lat: number
    lng: number
}

export function calculateMeasurements(points: Point[], mode: 'RECT3' | 'FOUR' | 'POLY') {
    if (points.length < 2) return null

    const turfPoints = points.map((p) => [p.lng, p.lat])

    // Close the polygon for POLY and FOUR modes
    let polygonPoints = [...turfPoints]
    if (mode === 'POLY' && points.length >= 3) {
        polygonPoints.push(turfPoints[0])
    } else if (mode === 'FOUR' && points.length === 4) {
        polygonPoints.push(turfPoints[0])
    } else if (mode === 'RECT3' && points.length === 3) {
        // For RECT3, we infer the 4th point
        const [p1, p2, p3] = turfPoints
        // Vector p1 -> p2 and p1 -> p3
        // We assume p1-p2 and p1-p3 are the sides. 4th point p4 = p2 + (p3 - p1)
        const p4 = [
            p2[0] + (p3[0] - p1[0]),
            p2[1] + (p3[1] - p1[1])
        ]
        polygonPoints = [p1, p2, p4, p3, p1]
    }

    if (polygonPoints.length < 4) {
        // Just distance if not enough points for polygon
        const line = turf.lineString(turfPoints)
        const length_m = turf.length(line, { units: 'meters' })
        return {
            length_m,
            length_ft: length_m * 3.28084,
            perimeter_m: length_m,
            perimeter_ft: length_m * 3.28084,
        }
    }

    try {
        const poly = turf.polygon([polygonPoints])
        const area_sqm = turf.area(poly)
        const perimeter_m = turf.length(turf.lineString(polygonPoints), { units: 'meters' })

        // For rectangles, try to infer length and width
        let length_m = 0
        let width_m = 0
        if (mode === 'RECT3' || mode === 'FOUR') {
            const d1 = turf.distance(turfPoints[0], turfPoints[1], { units: 'meters' })
            const d2 = turf.distance(turfPoints[1], mode === 'RECT3' ? polygonPoints[2] : turfPoints[2], { units: 'meters' })
            length_m = Math.max(d1, d2)
            width_m = Math.min(d1, d2)
        }

        return {
            area_sqm,
            area_sqft: area_sqm * 10.7639,
            perimeter_m,
            perimeter_ft: perimeter_m * 3.28084,
            length_m: length_m || undefined,
            length_ft: length_m ? length_m * 3.28084 : undefined,
            width_m: width_m || undefined,
            width_ft: width_m ? width_m * 3.28084 : undefined,
            points: polygonPoints.map(p => ({ lat: p[1], lng: p[0] }))
        }
    } catch (e) {
        console.error('Turf calculation error:', e)
        return null
    }
}
