'use client'

import { useState, useEffect } from 'react'
import MapLoader from '@/components/MapLoader'
import { Point, calculateMeasurements } from '@/lib/measurements'
import { Search, Ruler, Square, Hexagon as PolyIcon, Trash2, Save, Undo, MapPin, ChevronRight, ChevronLeft } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const extractPolygonPoints = (geojson: any): Point[] | null => {
  console.log('Extracting points from geojson:', geojson)
  if (!geojson) return null


  let coords: any[] = []

  if (geojson.type === 'Polygon') {
    coords = geojson.coordinates[0]
  } else if (geojson.type === 'MultiPolygon') {
    coords = geojson.coordinates[0][0]
  } else {
    return null
  }

  return coords.map((c: any) => ({ lat: c[1], lng: c[0] }))
}

export default function Home() {
  const [points, setPoints] = useState<Point[]>([])
  const [mode, setMode] = useState<'RECT3' | 'FOUR' | 'POLY' | 'NONE'>('NONE')
  const [address, setAddress] = useState<any>(null)
  const [measurements, setMeasurements] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [surveys, setSurveys] = useState<any[]>([])
  const [readOnly, setReadOnly] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationTimestamp, setLocationTimestamp] = useState(0)

  // Get user location on mount and define handler
  const locateUser = () => {
    if (!navigator.geolocation) {
      setNotification("Geolocation not supported")
      setTimeout(() => setNotification(null), 3000)
      return
    }

    setIsLocating(true)
    setNotification("Locating you...")

    const success = (position: GeolocationPosition) => {
      console.log("User location found:", position.coords.latitude, position.coords.longitude)
      setUserLocation([position.coords.latitude, position.coords.longitude])
      setLocationTimestamp(Date.now()) // Force map update
      setNotification(null)
      setIsLocating(false)
    }

    const error = (err: GeolocationPositionError) => {
      console.warn("High accuracy location failed, retrying with low accuracy...", err)
      // Retry with low accuracy
      navigator.geolocation.getCurrentPosition(
        success,
        (finalErr) => {
          console.error("Error getting user location:", finalErr)
          let msg = "Could not get your location."
          if (finalErr.code === 1) msg = "Location permission denied."
          if (finalErr.code === 2) msg = "Location unavailable."
          if (finalErr.code === 3) msg = "Location timeout."
          setNotification(msg)
          setTimeout(() => setNotification(null), 3000)
          setIsLocating(false)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      )
    }

    navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 })
  }

  useEffect(() => {
    locateUser()
  }, [])

  // Fetch surveys on load
  useEffect(() => {
    fetch('/api/surveys')
      .then(res => res.json())
      .then(data => {
        setSurveys(data.surveys || [])
        setReadOnly(data.readOnly)
      })
      .catch(err => console.error('Failed to fetch surveys:', err))
  }, [])

  // Calculate measurements when points or mode changes
  useEffect(() => {
    if (points.length >= 2 && mode !== 'NONE') {
      const results = calculateMeasurements(points, mode as any)
      setMeasurements(results)
    } else {
      setMeasurements(null)
    }
  }, [points, mode])

  const handleMapClick = async (lat: number, lng: number) => {
    if (mode === 'NONE') {
      // Direct geocoding on click
      setIsLoading(true)
      setPoints([{ lat, lng }]) // Optimistic update

      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
        if (!res.ok) throw new Error('Geocoding failed')

        const data = await res.json()
        setAddress(data)

        const boundaryPoints = extractPolygonPoints(data.geojson)
        if (boundaryPoints && boundaryPoints.length > 2) {
          setPoints(boundaryPoints)
          setMode('POLY')
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    } else {
      // Add point for measurement
      if (mode === 'RECT3' && points.length >= 3) return
      if (mode === 'FOUR' && points.length >= 4) return

      const newPoints = [...points, { lat, lng }]
      setPoints(newPoints)

      // If it's the first point of a measurement, geocode it
      if (newPoints.length === 1) {
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
          const data = await res.json()
          setAddress(data)
        } catch (err) {
          console.error(err)
        }
      }
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data && data.length > 0) {
        const first = data[0]
        setAddress(first)

        const boundaryPoints = extractPolygonPoints(first.geojson)
        if (boundaryPoints && boundaryPoints.length > 2) {
          setPoints(boundaryPoints)
          setMode('POLY')
        } else {
          setPoints([{ lat: parseFloat(first.lat), lng: parseFloat(first.lon) }])
          setNotification("No boundary data found. Please measure manually.")
          setTimeout(() => setNotification(null), 3000)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!address || !measurements) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: points[0].lat,
          longitude: points[0].lng,
          formattedAddress: address.display_name || address.formattedAddress,
          ...address.address,
          mode,
          points,
          ...measurements
        })
      })
      if (res.ok) {
        const saved = await res.json()
        setSurveys([saved, ...surveys])
        alert('Survey saved successfully!')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to save survey')
    } finally {
      setIsLoading(false)
    }
  }

  const clearAll = () => {
    setPoints([])
    setAddress(null)
    setMeasurements(null)
    setMode('NONE')
  }

  const undoLastPoint = () => {
    setPoints(points.slice(0, -1))
  }

  return (
    <main className="relative flex h-screen w-screen overflow-hidden bg-slate-900">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45] lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative h-full bg-white transition-all duration-300 border-r border-slate-200 shadow-xl overflow-hidden flex flex-col z-[50]",
          isSidebarOpen ? "w-[85vw] sm:w-80" : "w-0"
        )}>
        <div className="p-6 flex-shrink-0">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">LocaMetry</h1>
          <p className="text-slate-500 text-sm">Locate and Measure Property</p>

          <form onSubmit={handleSearch} className="mt-6 relative">
            <input
              type="text"
              placeholder="Search location..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          </form>
        </div>

        <div className="flex-grow overflow-y-auto px-6 pb-6 space-y-6">
          {/* Measurement Controls */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Measurement Mode</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setMode('RECT3'); setPoints([]); setMeasurements(null); }}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all",
                  mode === 'RECT3' ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                )}
              >
                <Square className="w-6 h-6 mb-1" />
                <span className="text-xs">RECT3</span>
              </button>
              <button
                onClick={() => { setMode('FOUR'); setPoints([]); setMeasurements(null); }}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all",
                  mode === 'FOUR' ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                )}
              >
                <Ruler className="w-6 h-6 mb-1" />
                <span className="text-xs">FOUR</span>
              </button>
              <button
                onClick={() => { setMode('POLY'); setPoints([]); setMeasurements(null); }}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all",
                  mode === 'POLY' ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                )}
              >
                <PolyIcon className="w-6 h-6 mb-1" />
                <span className="text-xs">POLY</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={undoLastPoint} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all">
                <Undo className="w-4 h-4" /> Undo
              </button>
              <button onClick={clearAll} className="flex-1 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all border border-rose-100">
                <Trash2 className="w-4 h-4" /> Clear
              </button>
            </div>
          </section>

          {/* Results Panel */}
          {address && (
            <section className="bg-slate-50 rounded-3xl p-5 border border-slate-100 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 leading-tight">Property Location</h3>
                  <p className="text-xs text-slate-500 mt-1">{address.display_name || address.formattedAddress}</p>
                </div>
              </div>

              {measurements && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Area</p>
                    <p className="text-sm font-bold text-slate-900">{measurements.area_sqft?.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px] font-medium text-slate-400">sqft</span></p>
                    <p className="text-[10px] text-slate-400">{measurements.area_sqm?.toLocaleString(undefined, { maximumFractionDigits: 1 })} sqm</p>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Perimeter</p>
                    <p className="text-sm font-bold text-slate-900">{measurements.perimeter_ft?.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[10px] font-medium text-slate-400">ft</span></p>
                    <p className="text-[10px] text-slate-400">{measurements.perimeter_m?.toLocaleString(undefined, { maximumFractionDigits: 1 })} m</p>
                  </div>
                  {measurements.length_ft && (
                    <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Length</p>
                      <p className="text-sm font-bold text-slate-900">{measurements.length_ft?.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft</p>
                    </div>
                  )}
                  {measurements.width_ft && (
                    <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Width</p>
                      <p className="text-sm font-bold text-slate-900">{measurements.width_ft?.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft</p>
                    </div>
                  )}
                </div>
              )}

              {!readOnly && (
                <button
                  onClick={handleSave}
                  disabled={isLoading || !measurements}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Save Survey
                </button>
              )}
              {readOnly && (
                <p className="text-[10px] text-center text-amber-600 font-medium">Read-only mode (Database unavailable)</p>
              )}
            </section>
          )}

          {/* Recent Surveys */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Saved Surveys</h2>
            <div className="space-y-3 pb-6">
              {surveys.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No surveys saved yet.</p>
              ) : (
                surveys.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAddress({ display_name: s.formattedAddress, address: s });
                      setPoints(s.points);
                      setMode(s.mode);
                    }}
                    className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all group"
                  >
                    <p className="text-xs font-bold text-slate-900 line-clamp-1">{s.formattedAddress}</p>
                    <div className="flex gap-3 mt-2 text-[10px] text-slate-500 font-medium">
                      <span>{s.area_sqft?.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqft</span>
                      <span>•</span>
                      <span>{s.mode}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>

      {/* Map Content */}
      <div className="flex-grow h-full relative z-0">
        <MapLoader
          onMapClick={handleMapClick}
          points={points}
          mode={mode}
          center={points.length > 0 ? [points[0].lat, points[0].lng] : (userLocation || [51.505, -0.09])}
          timestamp={locationTimestamp}
          userLocation={userLocation}
        />

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-[50] p-2 bg-white rounded-full shadow-xl border border-slate-200 transition-all text-slate-600 hover:text-blue-600"
          style={{
            left: isSidebarOpen
              ? (typeof window !== 'undefined' && window.innerWidth < 1024 ? 'calc(85vw - 16px)' : '304px')
              : '16px'
          }}
        >
          {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
        </button>

        <button
          onClick={locateUser}
          disabled={isLocating}
          className={cn(
            "absolute bottom-6 right-6 z-[400] p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-full shadow-xl border border-slate-200 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
            isLocating && "opacity-75 cursor-wait"
          )}
          title="Locate Me"
        >
          {isLocating ? (
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <MapPin className="w-6 h-6 text-blue-600" />
          )}
        </button>

        {/* Floating Tooltip */}
        <div className={cn(
          "absolute top-6 left-1/2 -translate-x-1/2 z-30 px-6 py-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold rounded-full shadow-2xl border border-white/10 flex items-center gap-3 transition-all",
          isSidebarOpen && "opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
        )}>
          <div className={cn("w-2 h-2 rounded-full", isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400")} />
          <span className="truncate max-w-[200px] sm:max-w-none">
            {notification ? notification : (mode === 'NONE' ? "Click anywhere to get address" : `Measuring: click to add points for ${mode}`)}
          </span>
        </div>

        {/* Mobile Bottom Results Card */}
        {address && !isSidebarOpen && (
          <div className="lg:hidden fixed bottom-20 left-4 right-4 z-[40] bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200 p-4 animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-grow min-w-0">
                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600 flex-shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 truncate">{address.display_name?.split(',')[0]}</h3>
                  <p className="text-[10px] text-slate-500 truncate">{address.display_name || address.formattedAddress}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                View Details
              </button>
            </div>

            {measurements && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white/50 p-2 rounded-xl border border-slate-100">
                  <p className="text-[8px] text-slate-400 uppercase font-bold">Area</p>
                  <p className="text-xs font-bold text-slate-900">{measurements.area_sqft?.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqft</p>
                </div>
                <div className="bg-white/50 p-2 rounded-xl border border-slate-100">
                  <p className="text-[8px] text-slate-400 uppercase font-bold">Perimeter</p>
                  <p className="text-xs font-bold text-slate-900">{measurements.perimeter_ft?.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft</p>
                </div>
              </div>
            )}

            {!readOnly && measurements && (
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
