'use client'

import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, Polygon, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import L from 'leaflet'

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

interface MapProps {
    onMapClick: (lat: number, lng: number) => void
    points: { lat: number; lng: number }[]
    mode: 'RECT3' | 'FOUR' | 'POLY' | 'NONE'
    zoom?: number
    center?: [number, number]
    timestamp?: number
    userLocation?: [number, number] | null
}

function MapEvents({ onClick }: { onClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng)
        },
    })
    return null
}

// Component to update map center when prop changes
function RecenterAutomatically({ center, zoom, timestamp }: { center: [number, number]; zoom: number; timestamp?: number }) {
    const map = useMapEvents({})
    useEffect(() => {
        map.setView(center, zoom)
    }, [center, zoom, map, timestamp])
    return null
}

export default function Map({ onMapClick, points, mode, zoom = 13, center = [51.505, -0.09], timestamp, userLocation }: MapProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return <div className="w-full h-full bg-slate-100 animate-pulse" />

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterAutomatically center={center} zoom={zoom} timestamp={timestamp} />
            <MapEvents onClick={onMapClick} />

            {userLocation && (
                <CircleMarker center={userLocation} radius={8} pathOptions={{ color: 'white', fillColor: '#2563eb', fillOpacity: 1, weight: 2 }}>
                    <Popup>You are here</Popup>
                </CircleMarker>
            )}

            {points.map((p, i) => (
                <Marker key={i} position={[p.lat, p.lng]}>
                    <Popup>Point {i + 1}</Popup>
                </Marker>
            ))}

            {points.length > 1 && mode !== 'NONE' && (
                <>
                    {mode === 'POLY' && points.length >= 3 ? (
                        <Polygon positions={points.map(p => [p.lat, p.lng])} color="blue" />
                    ) : (
                        <Polyline positions={points.map(p => [p.lat, p.lng])} color="blue" />
                    )}
                </>
            )}
        </MapContainer>
    )
}
