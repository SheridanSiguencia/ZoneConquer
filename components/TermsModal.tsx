// components/TermsModal.tsx
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = { visible: boolean; onAccept: () => void; onClose?: () => void };

export default function TermsModal({ visible, onAccept, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Terms of Service</Text>

          <ScrollView style={styles.body}>
            <Text style={styles.text}>
              {/* Replace with your real terms */}
              Move physically (walk/run/bike) to draw a trail. Complete a loop to claim territory.
              Crossing your open trail cancels expansion. Loops reset daily. No motor vehicles
              (cars, buses, trains, boats, planes). If speed exceeds our threshold, your area resets.
              By tapping “Accept” you agree to the Terms and Privacy Policy.
            </Text>
          </ScrollView>

          <View style={styles.row}>
  {onClose ? (
    <Pressable style={[styles.btn, styles.ghost]} onPress={onClose}>
      <Text style={styles.ghostText}>Cancel</Text>
    </Pressable>
  ) : null}
  <Pressable style={[styles.btn, styles.primary]} onPress={onAccept}>
    <Text style={styles.primaryText}>Accept</Text>
  </Pressable>
</View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "white", borderRadius: 16, padding: 18, maxHeight: "80%" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  body: { maxHeight: 320, marginBottom: 12 },
  text: { fontSize: 14, lineHeight: 20, color: "#111827" },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  primary: { backgroundColor: "#2563eb" },
  primaryText: { color: "white", fontWeight: "700" },
  ghost: { backgroundColor: "#f1f5f9" },
  ghostText: { color: "#0f172a", fontWeight: "700" }
});
