import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS, RADIUS } from '../theme';
import { fetchSimilarMaterials, importRecipes, mergeMaterials, readRecipes, type ImportRecipe, type ImportReport, type SimilarGroup } from '../api/aiApi';

const say = (title: string, msg?: string) => (Platform.OS === 'web' ? window.alert(msg ? `${title}\n${msg}` : title) : Alert.alert(title, msg));

const shown = (q: number, unit?: string) => {
  const u = (unit || '').toLowerCase();
  return u === 'kg' ? `${q} kg` : u === 'l' || u === 'litre' || u === 'ltr' ? `${q} L` : u === 'g' || u === 'ml' ? `${q} ${u}` : `${q}`;
};

/** Add recipes without typing them in: describe them, photograph a recipe card, or pick a photo or PDF. The AI reads them; you check before saving. */
export function AddRecipesModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recipes, setRecipes] = useState<ImportRecipe[] | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState('');

  const reset = () => { setText(''); setRecipes(null); setKeep([]); setReport(null); setError(''); };
  const close = () => { if (!busy) { reset(); onClose(); } };
  const load = (list: ImportRecipe[]) => { setRecipes(list); setKeep(list.map(() => true)); setReport(null); };
  const chosen = () => (recipes || []).filter((_, i) => keep[i]);

  const run = async (fn: () => Promise<ImportRecipe[]>) => {
    setBusy(true); setError('');
    try { load(await fn()); } catch (e: any) { setError(e?.message || 'Could not read that.'); } finally { setBusy(false); }
  };

  const fromText = () => run(() => readRecipes({ text }));
  const fromPhoto = () => run(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Allow photo access to choose a recipe photo.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) throw new Error('No photo chosen.');
    return readRecipes({ fileName: `recipe-${Date.now()}.jpg`, contentBase64: r.assets[0].base64! });
  });
  const fromCamera = () => run(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Allow camera access to photograph a recipe.');
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) throw new Error('No photo taken.');
    return readRecipes({ fileName: `recipe-${Date.now()}.jpg`, contentBase64: r.assets[0].base64! });
  });
  const fromPdf = () => run(async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) throw new Error('No file chosen.');
    const b64 = await FileSystem.readAsStringAsync(r.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
    return readRecipes({ fileName: r.assets[0].name || 'recipes.pdf', contentBase64: b64 });
  });

  const check = async () => {
    setBusy(true);
    try { setReport(await importRecipes(chosen(), false)); } catch (e: any) { say('Could not check the import', e?.message); } finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true);
    try {
      const r = await importRecipes(chosen(), true);
      say(`${r.recipes.length} recipe${r.recipes.length === 1 ? '' : 's'} added`, `${r.ingredientsCreated.length} new material${r.ingredientsCreated.length === 1 ? '' : 's'} created. Enter purchases to give them a cost.`);
      onDone(); reset(); onClose();
    } catch (e: any) { say('Import failed', e?.message); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={s.head}><Text style={s.title}>Add recipes with AI</Text><TouchableOpacity onPress={close}><Ionicons name="close" size={24} color={COLORS.ink} /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {!recipes ? (
            <>
              <Text style={s.p}>Type or paste one or more recipes in your own words, with the method if you have it. Or photograph a recipe card, or pick a photo or PDF. The AI reads the ingredients, quantities and method. You check everything before it is saved.</Text>
              <TextInput style={[s.input, { height: 140, textAlignVertical: 'top' }]} multiline value={text} onChangeText={setText}
                placeholder={'Steak pie (sells for K50). Per pie: 120 g steak mince, 40 g pastry, 1 egg.\nMethod: 1. Brown the mince 10 min. 2. Fill the pastry. 3. Bake at 190C for 25 min.'} />
              <TouchableOpacity style={[s.primary, text.trim().length < 10 && { opacity: 0.5 }]} onPress={fromText} disabled={busy || text.trim().length < 10}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Read the recipes</Text>}
              </TouchableOpacity>
              {Platform.OS !== 'web' && (
                <View style={s.row3}>
                  <TouchableOpacity style={s.ghost} onPress={fromCamera} disabled={busy}><Ionicons name="camera-outline" size={16} color={COLORS.navy} /><Text style={s.ghostTxt}>Camera</Text></TouchableOpacity>
                  <TouchableOpacity style={s.ghost} onPress={fromPhoto} disabled={busy}><Ionicons name="images-outline" size={16} color={COLORS.navy} /><Text style={s.ghostTxt}>Gallery</Text></TouchableOpacity>
                  <TouchableOpacity style={s.ghost} onPress={fromPdf} disabled={busy}><Ionicons name="document-outline" size={16} color={COLORS.navy} /><Text style={s.ghostTxt}>PDF</Text></TouchableOpacity>
                </View>
              )}
              {!!error && <Text style={s.err}>{error}</Text>}
            </>
          ) : (
            <>
              <Text style={s.p}>{recipes.length} recipe{recipes.length === 1 ? '' : 's'} found. Untick any you do not want, then check and import.</Text>
              {recipes.map((r, i) => (
                <TouchableOpacity key={i} style={s.recipe} activeOpacity={0.8} onPress={() => { setKeep(k => k.map((x, j) => (j === i ? !x : x))); setReport(null); }}>
                  <Ionicons name={keep[i] ? 'checkbox' : 'square-outline'} size={20} color={COLORS.navy} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{r.name}{r.price ? `  ·  K${r.price}` : ''}</Text>
                    <Text style={s.hint}>{r.ingredients.map(g => `${g.name} ${shown(g.qty, g.unit)}`).join(' · ')}</Text>
                    {(r.steps?.length || 0) > 0 && <Text style={s.hint}>Method: {r.steps!.map((st, n) => `${n + 1}. ${st.title}`).join('  ')}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              {report && (
                <View style={s.report}>
                  <Text style={s.name}>{report.recipes.length} would be added: {report.recipeItemsCreated} new product{report.recipeItemsCreated === 1 ? '' : 's'}, {report.recipeItemsMatched} already there.</Text>
                  <Text style={s.hint}>{report.ingredientsCreated.length} new material{report.ingredientsCreated.length === 1 ? '' : 's'}, {report.ingredientsMatched.length} matched to materials you have. Nothing is saved yet.</Text>
                  {report.recipesSkipped.map(x => <Text key={x.name} style={[s.hint, { color: '#B45309' }]}>Skipped {x.name}: {x.reason}</Text>)}
                </View>
              )}
              <View style={s.row3}>
                <TouchableOpacity style={s.ghost} onPress={check} disabled={busy || chosen().length === 0}><Text style={s.ghostTxt}>{busy && !report ? 'Checking…' : 'Check what would happen'}</Text></TouchableOpacity>
                <TouchableOpacity style={[s.primary, { flex: 1, marginTop: 0 }, !report && { opacity: 0.5 }]} onPress={apply} disabled={busy || !report}><Text style={s.primaryTxt}>{busy && report ? 'Importing…' : `Import ${chosen().length}`}</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={reset} style={{ alignItems: 'center', padding: 12 }}><Text style={{ color: COLORS.info, fontWeight: '600' }}>Start again</Text></TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Materials that are probably the same thing under different names: pick the one to keep and the rest are merged into it. */
export function MergeMaterialsModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [groups, setGroups] = useState<SimilarGroup[] | null>(null);
  const [keep, setKeep] = useState<Record<number, string>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    setGroups(null);
    fetchSimilarMaterials().then(g => { setGroups(g); setKeep(Object.fromEntries(g.map((x, i) => [i, x.suggestedKeep]))); setSkip({}); }).catch(() => setGroups([]));
  };
  React.useEffect(() => { if (visible) load(); }, [visible]);

  const merge = async (i: number) => {
    const g = groups![i];
    const ids = g.items.map(x => x.id).filter(id => id !== keep[i] && !skip[id]);
    if (!ids.length) { say('Choose at least one other material to merge'); return; }
    setBusy(i);
    try {
      const r = await mergeMaterials(keep[i], ids);
      say(`Merged ${r.merged} material${r.merged === 1 ? '' : 's'}`, `${r.recipesChanged} recipe${r.recipesChanged === 1 ? '' : 's'} updated.${r.kept.length ? ` ${r.kept.map(k => k.name).join(', ')} kept because of stock or purchase history.` : ''}`);
      onDone(); load();
    } catch (e: any) { say('Could not merge', e?.message); } finally { setBusy(null); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={s.head}><Text style={s.title}>Merge similar materials</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={COLORS.ink} /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={s.p}>If two recipes use the same material under different names, merge them so every recipe uses one and the planner orders it once. Only materials counted in the same unit are offered.</Text>
          {groups === null && <ActivityIndicator style={{ marginTop: 20 }} />}
          {groups && groups.length === 0 && <Text style={[s.name, { color: COLORS.success, marginTop: 16 }]}>No similar materials found.</Text>}
          {groups?.map((g, i) => (
            <View key={i} style={s.recipe}>
              <View style={{ flex: 1 }}>
                {g.items.map(it => (
                  <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
                    <TouchableOpacity onPress={() => setKeep(k => ({ ...k, [i]: it.id }))}><Ionicons name={keep[i] === it.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={COLORS.navy} /></TouchableOpacity>
                    <View style={{ flex: 1 }}><Text style={s.name}>{it.name}</Text><Text style={s.hint}>in {it.usedIn} recipe{it.usedIn === 1 ? '' : 's'}{it.onHand ? `, ${it.onHand} in stock` : ''}</Text></View>
                    {keep[i] !== it.id
                      ? <TouchableOpacity onPress={() => setSkip(sk => ({ ...sk, [it.id]: !sk[it.id] }))}><Text style={{ fontSize: 12, color: skip[it.id] ? COLORS.subtle : COLORS.navy, fontWeight: '700' }}>{skip[it.id] ? 'not merging' : 'merge'}</Text></TouchableOpacity>
                      : <Text style={{ fontSize: 12, color: COLORS.success, fontWeight: '700' }}>keep</Text>}
                  </View>
                ))}
                <TouchableOpacity style={s.primary} onPress={() => merge(i)} disabled={busy === i}>{busy === i ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Merge into the one marked keep</Text>}</TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 52 : 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.ink },
  p: { fontSize: 13, color: COLORS.subtle, lineHeight: 19, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.ink },
  primary: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy, borderRadius: RADIUS.md, paddingVertical: 13, marginTop: 12 },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  row3: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ghost: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, flex: 1 },
  ghostTxt: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  err: { color: COLORS.danger, marginTop: 10, fontSize: 13 },
  recipe: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, marginTop: 8 },
  name: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  hint: { fontSize: 11, color: COLORS.subtle, marginTop: 2 },
  report: { backgroundColor: COLORS.surfaceMuted, borderRadius: 10, padding: 10, marginTop: 10, gap: 3 },
});
