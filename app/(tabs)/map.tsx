// app/(tabs)/map.tsx
// ride screen with distance in miles, bottom hud, and a privacy mask toggle

import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'

// tiny type
type LatLng = { latitude: number; longitude: number }

// default from env (optional)
const DEFAULT_MASK =
  (process.env.EXPO_PUBLIC_MASK_LOCATION ?? 'true').toString() === 'true'

// quick distance between two lat/lngs (meters)
const haversineMeters = (a: LatLng, b: LatLng) => {
  const toRad = (x: number) => (x * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export default function MapScreen() {
  // masked or real position we render with
  const [current, setCurrent] = useState<LatLng | null>(null)
  const [path, setPath] = useState<LatLng[]>([])
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [maskLocation, setMaskLocation] = useState<boolean>(DEFAULT_MASK)
  const [isTracking, setIsTracking] = useState(false)

  // handles
  const watchRef = useRef<Location.LocationSubscription | null>(null)
  const maskRef = useRef<{ dLat: number; dLon: number } | null>(null)

  // apply current mask offset
  const mask = (p: LatLng): LatLng => {
    if (!maskLocation || !maskRef.current) return p
    return {
      latitude: p.latitude + maskRef.current.dLat,
      longitude: p.longitude + maskRef.current.dLon,
    }
  }

  // init on mount and when mask mode changes
  useEffect(() => {
    stopTracking()
    maskRef.current = null
    setPath([])
    setDistanceMeters(0)

    ;(async () => {
      await Location.requestForegroundPermissionsAsync()

      const loc = await Location.getCurrentPositionAsync({})
      const raw = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }

      if (maskLocation && !maskRef.current) {
        // random 6–10mi shift? nah keep 6–10km so local geometry still feels right
        // but miles display won’t care since it’s a constant offset
        const distanceM = 6000 + Math.random() * 4000
        const angle = Math.random() * Math.PI * 2
        const metersPerDegLat = 111111
        const metersPerDegLon = 111111 * Math.cos((raw.latitude * Math.PI) / 180)
        const dLat = (distanceM * Math.cos(angle)) / metersPerDegLat
        const dLon = (distanceM * Math.sin(angle)) / metersPerDegLon
        maskRef.current = { dLat, dLon }
      }

      const first = mask(raw)
      setCurrent(first)
      setPath([first])
    })()

    return () => stopTracking()
  }, [maskLocation])

  // start watching movement every ~2s or 5m
  const startTracking = async () => {
    if (watchRef.current) return
    setIsTracking(true)

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 5 },
      loc => {
        const raw = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
        const p = mask(raw)

        setCurrent(p)
        setPath(prev => {
          if (prev.length === 0) return [p]

          // filters to keep distance sane
          const last = prev[prev.length - 1]
          const delta = haversineMeters(last, p)

          const acc = loc.coords.accuracy ?? 0
          const badAccuracy = acc && acc > 50          // ignore poor fixes
          const tooSmall = delta < 3                    // ignore jitter
          const tooLarge = delta > 200                  // ignore spikes

          if (!badAccuracy && !tooSmall && !tooLarge) {
            setDistanceMeters(d => d + delta)
            return [...prev, p]
          }
          // still move the current marker even if we skip adding to the path
          return prev
        })
      }
    )
  }

  // stop the watcher
  const stopTracking = () => {
    watchRef.current?.remove()
    watchRef.current = null
    setIsTracking(false)
  }

  // toggle privacy mask
  const toggleMask = () => setMaskLocation(m => !m)

  // convert meters → miles for display
  const distanceMi = distanceMeters / 1609.344

  // fallback center so the map isn’t empty
  const region = {
    latitude: current?.latitude ?? 40.7812,
    longitude: current?.longitude ?? -73.9665,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        // hide native dot when masked so we don’t leak real location
        showsUserLocation={!maskLocation}
        followsUserLocation={!maskLocation}
        initialRegion={region}
        region={current ? region : undefined}
      >
        {/* show a custom blue dot when masked */}
        {maskLocation && current && (
          <Marker coordinate={current} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.fakeDotOuter}>
              <View style={styles.fakeDotInner} />
            </View>
          </Marker>
        )}

        {/* breadcrumb line */}
        {path.length > 1 && <Polyline coordinates={path} strokeWidth={4} />}
      </MapView>

      {/* bottom hud */}
      <View style={styles.hud}>
        {/* top row inside the card */}
        <View style={styles.hudTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hudLabel}>distance</Text>
            <Text style={styles.hudValue}>{distanceMi.toFixed(2)} mi</Text>
          </View>

          <Pressable
            onPress={toggleMask}
            style={[styles.maskChip, maskLocation ? styles.maskOn : styles.maskOff]}
          >
            <Ionicons
              name={maskLocation ? 'eye-off-outline' : 'eye-outline'}
              size={14}
              color={maskLocation ? '#86efac' : '#e5e7eb'}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.maskChipText}>{maskLocation ? 'mask on' : 'mask off'}</Text>
          </Pressable>
        </View>

        {/* buttons row */}
        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.start, isTracking && styles.btnDisabled]}
            onPress={startTracking}
            disabled={isTracking}
          >
            <Ionicons name='play' size={16} color='#fff' style={{ marginRight: 6 }} />
            <Text style={styles.btnText}>start</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.stop, !isTracking && styles.btnDisabled]}
            onPress={stopTracking}
            disabled={!isTracking}
          >
            <Ionicons name='stop' size={16} color='#fff' style={{ marginRight: 6 }} />
            <Text style={styles.btnText}>stop</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // floating panel at the bottom
  hud: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(10,15,25,0.85)',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  // top row inside the hud: distance on left, mask chip on right
  hudTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  hudLabel: { color: '#cbd5e1', fontSize: 12, textTransform: 'lowercase' },
  hudValue: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },

  // mask toggle chip
  maskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  maskOn: { backgroundColor: '#0a1a12', borderColor: '#22c55e' },
  maskOff: { backgroundColor: '#111827', borderColor: '#cbd5e1' },
  maskChipText: { color: '#e5e7eb', fontWeight: '800', textTransform: 'lowercase' },

  // buttons
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnDisabled: { opacity: 0.5 },
  start: { backgroundColor: '#22c55e' },
  stop: { backgroundColor: '#ef4444' },
  btnText: { color: '#fff', fontWeight: '800', textTransform: 'lowercase' },

  // custom masked blue dot
  fakeDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderWidth: 2,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
})
