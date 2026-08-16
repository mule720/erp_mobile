import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';

const NAVY = '#1E3A5F';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  children: React.ReactNode;
}

export default function FormModal({
  visible, title, onClose, onSubmit,
  submitLabel = 'Save', submitting = false, children,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={onSubmit} disabled={submitting} style={[s.saveBtn, submitting && { opacity: 0.5 }]}>
            <Text style={s.saveText}>{submitting ? '…' : submitLabel}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }} keyboardShouldPersistTaps="handled">
          <View style={{ padding: 16 }}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  closeBtn: { padding: 8 },
  closeText: { fontSize: 18, color: '#6B7280' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: NAVY, textAlign: 'center' },
  saveBtn: { backgroundColor: NAVY, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
