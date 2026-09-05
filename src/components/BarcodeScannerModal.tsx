import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}

// Real camera-based barcode/QR scanning via expo-camera's built-in scanner
// (native only - iOS/Android). expo-camera has no barcode-scanning support
// on web, so the "Scan" entry point that opens this should itself be
// hidden on Platform.OS === 'web' (see POSScreen.tsx) rather than showing
// a scanner that can never detect anything.
export default function BarcodeScannerModal({ visible, onClose, onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false); // debounce - one scan per open
  const lockedRef = useRef(false);

  useEffect(() => {
    if (visible) { setLocked(false); lockedRef.current = false; }
  }, [visible]);

  useEffect(() => {
    if (visible && !permission?.granted) requestPermission();
  }, [visible, permission?.granted, requestPermission]);

  const handleScanned = ({ data }: { data: string }) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    onScanned(data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
            onBarcodeScanned={locked ? undefined : handleScanned}
          />
        ) : (
          <View style={s.permissionState}>
            <Ionicons name="camera-outline" size={40} color="#94A3B8" />
            <Text style={s.permissionText}>
              {permission?.canAskAgain === false
                ? 'Camera access was denied. Enable it in Settings to scan.'
                : 'Requesting camera access…'}
            </Text>
          </View>
        )}

        <View style={s.frame} pointerEvents="none">
          <View style={s.corner} />
        </View>

        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.title}>Scan Barcode / QR</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={s.hint}>Point the camera at a product's barcode or QR code</Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 40 : 56, paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: { width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontFamily: FONT.heading },

  frame: { position: 'absolute', top: '30%', left: '15%', right: '15%', bottom: '38%', alignItems: 'center', justifyContent: 'center' },
  corner: { width: '100%', height: '100%', borderWidth: 2, borderColor: COLORS.amberLight, borderRadius: RADIUS.lg },

  hint: {
    position: 'absolute', bottom: 48, left: 24, right: 24, textAlign: 'center',
    color: '#fff', fontSize: 13, fontFamily: FONT.bodyRegular,
  },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  permissionText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', fontFamily: FONT.bodyRegular },
});
