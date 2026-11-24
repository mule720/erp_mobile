/**
 * Soft-POS screen for NetOn ERP Pro staff.
 *
 * Opened automatically when a soft_pos_session push notification arrives.
 * Receives: session_id, amount, currency, description, app_id via route params.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { completeSoftPosSession, failSoftPosSession } from '../lib/softPosApi';

export interface SoftPOSParams {
  session_id: string;
  amount: string;
  currency: string;
  description: string;
  app_id?: string;
}

interface Props {
  route: { params: SoftPOSParams };
  navigation: { goBack: () => void };
}

const SESSION_TIMEOUT_SECS = 600;

export default function SoftPOSScreen({ route, navigation }: Props) {
  const { session_id: sessionId, amount, currency, description } = route.params ?? {};

  const [status, setStatus] = useState<'waiting' | 'loading' | 'success' | 'failed' | 'expired'>('waiting');
  const [secondsLeft, setSecondsLeft] = useState(SESSION_TIMEOUT_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setStatus('expired');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function formatTimer(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const handleAccept = useCallback(async () => {
    if (!sessionId) return;
    clearInterval(timerRef.current!);
    setStatus('loading');
    try {
      const result = await completeSoftPosSession(sessionId);
      setStatus(result.ok ? 'success' : 'failed');
    } catch {
      setStatus('failed');
    }
  }, [sessionId]);

  const handleCancel = useCallback(async () => {
    if (!sessionId) return;
    Alert.alert('Cancel payment?', 'The customer will be notified the payment was cancelled.', [
      { text: 'Keep waiting', style: 'cancel' },
      {
        text: 'Cancel payment',
        style: 'destructive',
        onPress: async () => {
          clearInterval(timerRef.current!);
          setStatus('loading');
          try {
            await failSoftPosSession(sessionId, 'cancelled_by_staff');
          } catch { /* ignore */ }
          setStatus('failed');
        },
      },
    ]);
  }, [sessionId]);

  const goBack = () => navigation.goBack();

  const formattedAmount =
    currency && amount
      ? `${currency} ${parseFloat(amount).toLocaleString('en-ZM', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : amount ?? '';

  if (status === 'success') {
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultIcon}>✓</Text>
        <Text style={styles.resultTitle}>Payment Accepted</Text>
        <Text style={styles.resultSub}>The customer can now tap their card.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={goBack}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={[styles.resultContainer, styles.failedBg]}>
        <Text style={[styles.resultIcon, styles.failedIcon]}>✕</Text>
        <Text style={styles.resultTitle}>Payment Cancelled</Text>
        <Text style={styles.resultSub}>The session has been cancelled.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={goBack}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'expired') {
    return (
      <View style={[styles.resultContainer, styles.failedBg]}>
        <Text style={[styles.resultIcon, styles.failedIcon]}>⏰</Text>
        <Text style={styles.resultTitle}>Session Expired</Text>
        <Text style={styles.resultSub}>The 10-minute session window has closed.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={goBack}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tap to Pay</Text>

      <View style={styles.card}>
        <Text style={styles.amountLabel}>Amount due</Text>
        <Text style={styles.amount}>{formattedAmount}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>

      <Text style={styles.waiting}>Waiting for customer to tap…</Text>

      <Text style={styles.timer}>
        {status === 'loading' ? '' : `Session expires in ${formatTimer(secondsLeft)}`}
      </Text>

      {status === 'loading' ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptBtnText}>Accept Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: { fontSize: 22, fontWeight: '700', color: '#2563EB', marginBottom: 32 },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 28,
  },
  amountLabel: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  amount: { fontSize: 44, fontWeight: '800', color: '#2563EB' },
  description: { fontSize: 15, color: '#64748B', marginTop: 12, textAlign: 'center' },
  waiting: { fontSize: 16, color: '#475569', marginBottom: 8 },
  timer: { fontSize: 14, color: '#94A3B8', marginBottom: 40 },
  acceptBtn: {
    width: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  acceptBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancelBtn: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#DC2626', fontSize: 16, fontWeight: '600' },
  resultContainer: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  failedBg: { backgroundColor: '#FFF5F5' },
  resultIcon: { fontSize: 72, color: '#16A34A', marginBottom: 20 },
  failedIcon: { color: '#DC2626' },
  resultTitle: { fontSize: 24, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  resultSub: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 40 },
  doneBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
