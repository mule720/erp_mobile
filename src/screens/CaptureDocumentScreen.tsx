import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Modal, Platform, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { gql } from '../api/graphql';
import PickField from '../components/PickField';
import { useAuth } from '../store/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../theme';
import {
  attachDocument, captureDocument, createSupplierBill, extractSupplierBill, money, submitExpenseClaim,
  type Facts, type Match,
} from '../api/aiApi';

const KIND_LABEL: Record<string, string> = {
  supplier_invoice: 'Supplier invoice', customer_invoice: 'Invoice we issued', receipt: 'Receipt', delivery_note: 'Delivery note', purchase_order: 'Purchase order',
  quotation: 'Quotation', payment_proof: 'Proof of payment', bank_statement: 'Bank statement', contract: 'Contract', other: 'Other document',
};
const ATTACH_KIND: Record<string, string> = {
  supplier_invoice: 'invoice', customer_invoice: 'invoice', receipt: 'receipt', delivery_note: 'delivery_note', purchase_order: 'purchase_order',
  quotation: 'quotation', payment_proof: 'receipt', bank_statement: 'bank_statement', contract: 'contract', other: '',
};
const actionFor = (k: string) => (k === 'supplier_invoice' ? 'bill' : k === 'receipt' ? 'claim' : k === 'bank_statement' ? 'bank' : 'file');
const today = () => new Date().toISOString().slice(0, 10);
const say = (title: string, msg?: string) => (Platform.OS === 'web' ? window.alert(msg ? `${title}\n${msg}` : title) : Alert.alert(title, msg));

/** Photograph any business document: the AI says what it is and reads it, and you confirm where it goes. */
export default function CaptureDocumentScreen({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { tenant } = useAuth();
  const t = tenant?.id ?? '';
  const cam = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [camOpen, setCamOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proof, setProof] = useState<{ name: string; base64: string; mediaType: string } | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [manualNote, setManualNote] = useState('');
  const [kind, setKind] = useState('other');
  const [matches, setMatches] = useState<Match[]>([]);
  const [target, setTarget] = useState('inbox');
  // supplier bill
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState('');
  // expense claim
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [claimLines, setClaimLines] = useState<{ description: string; amount: string }[]>([]);

  const reset = () => { setProof(null); setFacts(null); setDraft(null); setError(''); setMatches([]); setTarget('inbox'); setManualNote(''); };

  const read = async (name: string, base64: string, mediaType: string) => {
    setBusy(true); setError('');
    try {
      setProof({ name, base64, mediaType });
      const r = await captureDocument(t, name, base64);
      setFacts(r.facts); setKind(r.facts.kind); setMatches(r.matches); setManualNote(r.manual || '');
      setTarget(r.matches[0] ? `${r.matches[0].documentType}:${r.matches[0].documentId}` : 'inbox');
      setPurpose(r.facts.summary || r.facts.party || '');
      setClaimLines((r.facts.lines.length ? r.facts.lines : [{ description: r.facts.party || 'Receipt', quantity: null, amount: r.facts.total }])
        .map(l => ({ description: l.description, amount: l.amount != null ? String(l.amount) : '' })));
    } catch (e: any) { setError(e?.message || 'Could not read the document'); } finally { setBusy(false); }
  };

  const snap = async () => {
    try {
      const p = await cam.current?.takePictureAsync({ quality: 0.6, base64: true });
      if (!p?.base64) throw new Error('The photo could not be taken');
      setCamOpen(false);
      await read(`capture-${Date.now()}.jpg`, p.base64, 'image/jpeg');
    } catch (e: any) { setCamOpen(false); setError(e?.message || 'The photo could not be taken'); }
  };

  const openCamera = async () => {
    if (!permission?.granted) { const r = await requestPermission(); if (!r.granted) { setError('Allow camera access to photograph documents.'); return; } }
    setCamOpen(true);
  };

  // phone: a photo already in the gallery, or a PDF
  const pickGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Allow photo access to choose a picture.'); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
      if (r.canceled || !r.assets?.[0]?.base64) return;
      await read(`capture-${Date.now()}.jpg`, r.assets[0].base64!, 'image/jpeg');
    } catch (e: any) { setError(e?.message || 'Could not open the picture'); }
  };
  const pickPdf = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      if (a.size && a.size > 8 * 1024 * 1024) { setError('That PDF is larger than 8 MB.'); return; }
      const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 });
      await read(a.name || `document-${Date.now()}.pdf`, b64, 'application/pdf');
    } catch (e: any) { setError(e?.message || 'Could not open the PDF'); }
  };

  // web: pick a file (photo or PDF)
  const pickFile = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf,image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const f = input.files?.[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => read(f.name, String(rd.result).split(',')[1] || '', f.type || 'image/jpeg');
      rd.readAsDataURL(f);
    };
    input.click();
  };

  // load the lists the chosen action needs
  useEffect(() => {
    if (!facts) return;
    const a = actionFor(kind);
    if (a === 'bill' && !suppliers.length) gql<any>(`{ supplyChainSuppliers }`).then(d => setSuppliers((d?.supplyChainSuppliers || []).map((x: any) => ({ id: String(x.id), name: x.name })))).catch(() => {});
    if (a === 'claim' && !employees.length) gql<any>(`query($t:UUID!){ employees(tenantId:$t,limit:200){ id firstName lastName } }`, { t })
      .then(d => setEmployees((d?.employees || []).map((e: any) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` })))).catch(() => {});
  }, [facts, kind]);

  const readBill = async () => {
    if (!proof) return;
    setBusy(true);
    try {
      const d = await extractSupplierBill(t, proof.name, proof.mediaType, proof.base64);
      setDraft(d); setSupplierId(d.supplierId || ''); setBillNumber(d.billNumber || ''); setBillDate(d.billDate || today());
    } catch (e: any) { say('Could not read the bill', e?.message); } finally { setBusy(false); }
  };

  const saveBill = async () => {
    if (!proof || !draft) return;
    if (!supplierId || !billNumber.trim() || !billDate) { say('Choose the supplier and check the number and date'); return; }
    setBusy(true);
    try {
      const lines = draft.lines.map((l: any) => ({ productId: l.productId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, purchaseType: l.productId ? 'inventory' : 'expense' }));
      const bill = await createSupplierBill(t, supplierId, billNumber.trim(), billDate, draft.dueDate || null, lines);
      let filed = true;
      try { await attachDocument(t, 'supplier_bill', bill.id, proof.name, proof.base64, 'invoice'); } catch { filed = false; }
      say('Draft bill created', `${bill.billNumber}. ${filed ? 'The original is filed with it.' : 'The document could not be filed: attach it from the bill.'}`);
      reset();
    } catch (e: any) { say('Could not save the bill', e?.message); } finally { setBusy(false); }
  };

  const saveClaim = async () => {
    const lines = claimLines.filter(l => l.description.trim() && Number(l.amount) > 0);
    if (!employeeId || !purpose.trim() || !lines.length) { say('Choose the employee, a purpose and at least one line'); return; }
    setBusy(true);
    try {
      const day = facts?.date || today();
      const claim = await submitExpenseClaim(t, employeeId, purpose, day, lines.map(l => ({ date: day, description: l.description, amount: Number(l.amount), expenseAccountCode: '', receiptReference: facts?.number || '' })));
      let filed = true;
      try { if (claim?.id && proof) await attachDocument(t, 'expense_claim', claim.id, proof.name, proof.base64, 'receipt'); } catch { filed = false; }
      say(`Claim ${claim?.claimNumber || ''} submitted`, filed ? 'The receipt is filed with it.' : 'The receipt could not be filed: attach it from the claim.');
      reset();
    } catch (e: any) { say('Claim failed', e?.message); } finally { setBusy(false); }
  };

  const fileIt = async () => {
    if (!proof) return;
    setBusy(true);
    try {
      const [dt, id] = target === 'inbox' ? ['inbox', t] : target.split(':');
      await attachDocument(t, dt, id, proof.name, proof.base64, ATTACH_KIND[kind] || '');
      const m = matches.find(x => `${x.documentType}:${x.documentId}` === target);
      say('Document filed', m ? `Kept with ${m.label}.` : 'Kept in the document inbox.');
      reset();
    } catch (e: any) { say('Could not file it', e?.message); } finally { setBusy(false); }
  };

  const action = actionFor(kind);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {!facts ? (
        <View style={s.card}>
          <Text style={s.h}>Capture a document</Text>
          <Text style={s.p}>Photograph an invoice, receipt, delivery note, order, payment slip or contract. The AI works out what it is and reads it. Nothing is saved until you confirm.</Text>
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={s.primary} onPress={openCamera} disabled={busy}><Ionicons name="camera-outline" size={18} color="#fff" /><Text style={s.primaryTxt}>Take a photo</Text></TouchableOpacity>
          )}
          {Platform.OS !== 'web' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={s.ghostBtn} onPress={pickGallery} disabled={busy}><Ionicons name="images-outline" size={16} color={COLORS.navy} /><Text style={s.ghostTxt}>From gallery</Text></TouchableOpacity>
              <TouchableOpacity style={s.ghostBtn} onPress={pickPdf} disabled={busy}><Ionicons name="document-outline" size={16} color={COLORS.navy} /><Text style={s.ghostTxt}>Choose a PDF</Text></TouchableOpacity>
            </View>
          )}
          {Platform.OS === 'web' && (
            <TouchableOpacity style={s.primary} onPress={pickFile} disabled={busy}><Ionicons name="document-attach-outline" size={18} color="#fff" /><Text style={s.primaryTxt}>Choose a photo or PDF</Text></TouchableOpacity>
          )}
          {busy && <View style={s.reading}><ActivityIndicator /><Text style={s.p}>Reading the document…</Text></View>}
          {!!error && <Text style={s.err}>{error}</Text>}
        </View>
      ) : (
        <View>
          <View style={s.card}>
            {!!manualNote && <Text style={s.warn}>{manualNote} Choose what this document is below and file it by hand.</Text>}
            <Text style={s.label}>{manualNote ? 'This is a' : 'This looks like'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <TouchableOpacity key={k} style={[s.chip, kind === k && s.chipOn]} onPress={() => { setKind(k); setDraft(null); }}><Text style={[s.chipTxt, kind === k && { color: '#fff' }]}>{v}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            {facts.confidence != null && <Text style={s.hint}>{Math.round(facts.confidence * 100)}% sure</Text>}
            {!!facts.summary && <Text style={[s.p, { marginTop: 6 }]}>{facts.summary}</Text>}
            <View style={s.grid}>
              <View style={s.cell}><Text style={s.hint}>From / to</Text><Text style={s.val}>{facts.party || '—'}</Text></View>
              <View style={s.cell}><Text style={s.hint}>Number</Text><Text style={s.val}>{facts.number || '—'}</Text></View>
              <View style={s.cell}><Text style={s.hint}>Date</Text><Text style={s.val}>{facts.date || '—'}</Text></View>
              <View style={s.cell}><Text style={s.hint}>Total</Text><Text style={s.val}>{facts.currency || ''} {facts.total != null ? money(facts.total).slice(2) : '—'}</Text></View>
            </View>
          </View>

          {action === 'bill' && !draft && (
            <View style={s.card}>
              <Text style={s.p}>{manualNote ? 'A bill from a supplier cannot be turned into a draft bill without the AI. File the original with the supplier\'s record instead.' : 'A bill from a supplier. Next it is matched to the supplier and your products so you can save it as a draft bill, with the original filed.'}</Text>
              {!manualNote && <TouchableOpacity style={s.primary} onPress={readBill} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Turn it into a supplier bill</Text>}</TouchableOpacity>}
            </View>
          )}

          {action === 'bill' && draft && (
            <View style={s.card}>
              {(draft.warnings || []).map((w: string, i: number) => <Text key={i} style={s.warn}>{w}</Text>)}
              <PickField label="Supplier" value={supplierId} items={suppliers} onPick={setSupplierId} />
              <Text style={s.label}>Bill number</Text><TextInput style={s.input} value={billNumber} onChangeText={setBillNumber} />
              <Text style={s.label}>Bill date (YYYY-MM-DD)</Text><TextInput style={s.input} value={billDate} onChangeText={setBillDate} />
              {draft.lines.map((l: any, i: number) => (
                <View key={i} style={s.lineRow}>
                  <Text style={{ flex: 1, fontSize: 13, color: COLORS.ink }}>{l.description}{l.productName ? `  →  ${l.productName}` : ''}</Text>
                  <Text style={s.val}>{l.quantity} × {Number(l.unitPrice).toFixed(2)}</Text>
                </View>
              ))}
              <TouchableOpacity style={s.primary} onPress={saveBill} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Save draft bill and file the original</Text>}</TouchableOpacity>
            </View>
          )}

          {action === 'claim' && (
            <View style={s.card}>
              <Text style={s.p}>A receipt is claimed back as an expense. Check the lines and say who is claiming.</Text>
              <PickField label="Employee claiming" value={employeeId} items={employees} onPick={setEmployeeId} />
              <Text style={s.label}>Purpose</Text><TextInput style={s.input} value={purpose} onChangeText={setPurpose} />
              {claimLines.map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TextInput style={[s.input, { flex: 1 }]} value={l.description} onChangeText={v => setClaimLines(x => x.map((r, j) => (j === i ? { ...r, description: v } : r)))} />
                  <TextInput style={[s.input, { width: 90 }]} keyboardType="decimal-pad" value={l.amount} onChangeText={v => setClaimLines(x => x.map((r, j) => (j === i ? { ...r, amount: v } : r)))} />
                </View>
              ))}
              <TouchableOpacity style={s.primary} onPress={saveClaim} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Submit the claim with the receipt</Text>}</TouchableOpacity>
            </View>
          )}

          {action === 'bank' && (
            <View style={s.card}>
              <Text style={s.p}>Bank statements are imported line by line in Finance, under bank reconciliation.</Text>
              <TouchableOpacity style={s.primary} onPress={() => onNavigate?.('finance')}><Text style={s.primaryTxt}>Go to Finance</Text></TouchableOpacity>
            </View>
          )}

          {action === 'file' && (
            <View style={s.card}>
              <Text style={s.h}>Which record does it belong to?</Text>
              {matches.map(m => {
                const key = `${m.documentType}:${m.documentId}`;
                return (
                  <TouchableOpacity key={key} style={[s.opt2, target === key && s.opt2On]} onPress={() => setTarget(key)}>
                    <Ionicons name={target === key ? 'radio-button-on' : 'radio-button-off'} size={18} color={COLORS.navy} />
                    <View style={{ flex: 1 }}><Text style={s.val}>{m.label}</Text><Text style={s.hint}>{m.reason}{m.amount != null ? ` · ${m.amount.toLocaleString()}` : ''}{m.date ? ` · ${m.date}` : ''}</Text></View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[s.opt2, target === 'inbox' && s.opt2On]} onPress={() => setTarget('inbox')}>
                <Ionicons name={target === 'inbox' ? 'radio-button-on' : 'radio-button-off'} size={18} color={COLORS.navy} />
                <View style={{ flex: 1 }}><Text style={s.val}>{matches.length ? 'None of these: ' : 'No matching record found: '}keep it in the document inbox</Text><Text style={s.hint}>You can attach it to a record later.</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={s.primary} onPress={fileIt} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>File the document</Text>}</TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={reset} style={{ alignItems: 'center', padding: 12 }}><Text style={s.link}>Start again with another document</Text></TouchableOpacity>
        </View>
      )}

      <Modal visible={camOpen} animationType="slide" onRequestClose={() => setCamOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cam} style={{ flex: 1 }} facing="back" />
          <View style={s.camBar}>
            <TouchableOpacity onPress={() => setCamOpen(false)}><Text style={{ color: '#fff', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={snap} style={s.shutter}><View style={s.shutterIn} /></TouchableOpacity>
            <View style={{ width: 50 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.card },
  h: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginBottom: 6 },
  p: { fontSize: 13, color: COLORS.subtle, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5 },
  hint: { fontSize: 11, color: COLORS.subtle },
  val: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy, borderRadius: RADIUS.md, paddingVertical: 13, marginTop: 12 },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ghostBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  ghostTxt: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  reading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14 },
  err: { color: COLORS.danger, marginTop: 10, fontSize: 13 },
  warn: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginRight: 6, marginTop: 4 },
  chipOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipTxt: { fontSize: 12, fontWeight: '600', color: COLORS.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  cell: { width: '50%', marginBottom: 8 },
  select: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: RADIUS.lg, maxHeight: '70%' },
  opt: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  optTxt: { fontSize: 14, color: COLORS.ink },
  opt2: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  opt2On: { borderColor: COLORS.navy, backgroundColor: COLORS.infoBg },
  lineRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  link: { color: COLORS.info, fontWeight: '600', fontSize: 13 },
  camBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 28, paddingBottom: 40 },
  shutter: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
});
