// app/(tabs)/map.tsx
// ride screen with privacy mask toggle
// start/stop tracking only (no conquer zone)

import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'

// tiny type
type LatLng = { latitude: number; longitude: number }

// default from env (optional)
const DEFAULT_MASK =
  (process.env.EXPO_PUBLIC_MASK_LOCATION ?? 'true').toString() === 'true'

export default function MapScreen() {
  // masked or real position we render with
  const [current, setCurrent] = useState<LatLng | null>(null)
  const [path, setPath] = useState<LatLng[]>([])
  const [maskLocation, setMaskLocation] = useState<boolean>(DEFAULT_MASK)

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

    ;(async () => {
      await Location.requestForegroundPermissionsAsync()

      const loc = await Location.getCurrentPositionAsync({})
      const raw = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }

      if (maskLocation && !maskRef.current) {
        // random 6–10km shift, stable for this session
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

  // toggle privacy mask
  const toggleMask = () => setMaskLocation(m => !m)

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

      {/* hud overlay */}
      <View style={styles.hud}>
        <View style={styles.hudTop}>
          <Text style={styles.hudTitle}>ride</Text>
          <Pressable
            onPress={toggleMask}
            style={[styles.maskChip, maskLocation ? styles.maskOn : styles.maskOff]}
          >
            <Text style={styles.maskChipText}>{maskLocation ? 'mask on' : 'mask off'}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.start]} onPress={startTracking}>
            <Text style={styles.btnText}>start</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.stop]} onPress={stopTracking}>
            <Text style={styles.btnText}>stop</Text>
          </Pressable>
        </View>

        <Text style={styles.meta}>points: {path.length}</Text>
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

  maskChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  maskOn: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  maskOff: { backgroundColor: '#1f2937', borderColor: '#cbd5e1' },
  maskChipText: { color: '#e5e7eb', fontWeight: '800', textTransform: 'lowercase' },

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
  btnText: { color: '#fff', fontWeight: '700' },
  meta: { color: '#fff', textAlign: 'center', marginTop: 6, opacity: 0.9 },

  // custom masked "blue dot"
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
