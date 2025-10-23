// app/(tabs)/map.tsx
// ride screen with a privacy mask you can toggle
// when masked, we draw our own blue dot so you still see "you" on the map

import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import MapView, { Circle, Marker, Polyline } from 'react-native-maps'

// tiny types
type LatLng = { latitude: number; longitude: number }
type Zone = { id: string; center: LatLng; radius: number }

// default from env (optional). set EXPO_PUBLIC_MASK_LOCATION=true/false in .env
const DEFAULT_MASK =
  (process.env.EXPO_PUBLIC_MASK_LOCATION ?? 'true').toString() === 'true'

export default function MapScreen() {
  // state we render with (masked or real depending on the toggle)
  const [current, setCurrent] = useState<LatLng | null>(null)
  const [path, setPath] = useState<LatLng[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [maskLocation, setMaskLocation] = useState<boolean>(DEFAULT_MASK)

  // handles we keep around
  const watchRef = useRef<Location.LocationSubscription | null>(null)
  const maskRef = useRef<{ dLat: number; dLon: number } | null>(null)

  // apply the current mask offset
  const mask = (p: LatLng): LatLng => {
    if (!maskLocation || !maskRef.current) return p
    return {
      latitude: p.latitude + maskRef.current.dLat,
      longitude: p.longitude + maskRef.current.dLon,
    }
  }

  // (re)initialize when the screen mounts or when mask mode changes
  useEffect(() => {
    stopTracking()
    maskRef.current = null
    setPath([])
    setZones([])

    ;(async () => {
      await Location.requestForegroundPermissionsAsync()

      const loc = await Location.getCurrentPositionAsync({})
      const raw = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }

      // build a stable offset once, based on the first fix
      if (maskLocation && !maskRef.current) {
        const distanceM = 6000 + Math.random() * 4000 // 6–10 km
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

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 5 },
      loc => {
        const raw = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
        const p = mask(raw)
        setCurrent(p)
        setPath(prev => [...prev, p])
      }
    )
  }

  // stop the watcher
  const stopTracking = () => {
    watchRef.current?.remove()
    watchRef.current = null
  }

  // drop a zone where you are (masked or real depending on toggle)
  const conquerZone = () => {
    if (!current) return
    setZones(z => [...z, { id: String(Date.now()), center: current, radius: 60 }]) // ~60m radius
  }

  // toggle the privacy mask at runtime
  const toggleMask = () => setMaskLocation(m => !m)

  // if no gps yet, center on central park so the map isn’t empty
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
        // hide the native blue dot when masked so we never leak the real spot
        showsUserLocation={!maskLocation}
        followsUserLocation={!maskLocation}
        initialRegion={region}
        region={current ? region : undefined}
      >
        {/* when masked, draw our own blue dot at the masked position */}
        {maskLocation && current && (
          <Marker
            coordinate={current}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.fakeDotOuter}>
              <View style={styles.fakeDotInner} />
            </View>
          </Marker>
        )}

        {/* breadcrumb line */}
        {path.length > 1 && <Polyline coordinates={path} strokeWidth={4} />}

        {/* conquered zones */}
        {zones.map(z => (
          <Circle
            key={z.id}
            center={z.center}
            radius={z.radius}
            strokeColor='rgba(34,197,94,0.9)'
            fillColor='rgba(34,197,94,0.25)'
            strokeWidth={2}
          />
        ))}
      </MapView>

      {/* hud overlay */}
      <View style={styles.hud}>
        <View style={styles.hudTop}>
          <Text style={styles.hudTitle}>ride</Text>
          <Pressable
            onPress={toggleMask}
            style={[styles.maskChip, maskLocation ? styles.maskOn : styles.maskOff]}
          >
            <Text style={styles.maskChipText}>
              {maskLocation ? 'mask on' : 'mask off'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.start]} onPress={startTracking}>
            <Text style={styles.btnText}>start</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.stop]} onPress={stopTracking}>
            <Text style={styles.btnText}>stop</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.conquer]} onPress={conquerZone}>
            <Text style={styles.btnText}>conquer zone</Text>
          </Pressable>
        </View>

        <Text style={styles.meta}>
          zones: {zones.length} · points: {path.length}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 12,
    borderRadius: 16,
  },
  hudTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hudTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  maskChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  maskOn: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  maskOff: { backgroundColor: '#1f2937', borderColor: '#cbd5e1' },

  row: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  start: { backgroundColor: '#22c55e' },
  stop: { backgroundColor: '#ef4444' },
  conquer: { backgroundColor: '#3b82f6' },
  btnText: { color: '#fff', fontWeight: '700' },
  meta: { color: '#fff', textAlign: 'center', marginTop: 6, opacity: 0.9 },

  // custom masked "blue dot"
  fakeDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59,130,246,0.25)', // soft blue halo
    borderWidth: 2,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6', // solid blue center
  },
})
