import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';
const GREEN = '#16A34A';

const fmt = (n: any) => new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', maximumFractionDigits: 2 }).format(Number(n ?? 0));

interface Product { id: string; name: string; sku: string; unitPrice: number; stockLevel: number; category: string; }
interface CartItem { product: Product; qty: number; price: number; }

export default function POSScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{ supplyChainProducts }`);
      const raw = d?.supplyChainProducts || [];
      const prods = raw
        .filter((p: any) => p.is_active !== false && p.isActive !== false)
        .map((p: any) => ({
          id: p.id, name: p.name, sku: p.sku || '',
          unitPrice: p.unit_price ?? p.unitPrice ?? p.price ?? 0,
          stockLevel: p.stock ?? p.stock_level ?? p.stockLevel ?? null,
          category: p.category || '',
        }));
      setProducts(prods); setFiltered(prods);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  useEffect(() => {
    let list = products;
    if (activeCategory !== 'All') list = list.filter(p => p.category === activeCategory);
    if (search) list = list.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [search, activeCategory, products]);

  const addToCart = (product: Product) => {
    setCart(c => {
      const existing = c.find(i => i.product.id === product.id);
      if (existing) return c.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { product, qty: 1, price: product.unitPrice }];
    });
  };

  const removeFromCart = (productId: string) => setCart(c => c.filter(i => i.product.id !== productId));
  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart(c => c.map(i => i.product.id === productId ? { ...i, qty } : i));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const change = payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) - total : 0;

  const processPayment = async () => {
    if (cart.length === 0) { Alert.alert('Empty Cart', 'Add items before processing payment'); return; }
    if (payMethod === 'cash' && parseFloat(cashReceived || '0') < total) {
      Alert.alert('Insufficient', 'Cash received is less than total'); return;
    }
    setProcessing(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lines = JSON.stringify(cart.map(i => ({
        description: i.product.name,
        quantity: i.qty,
        unitPrice: i.price,
        taxRate: 0.16,
      })));
      // 1. Create invoice
      const inv = await gql<any>(
        `mutation($t:UUID!,$input:SalesInvoiceInput!){createSalesInvoice(tenantId:$t,input:$input){ok error invoice{id invoiceNumber}}}`,
        { t: tenantId, input: { customerName: 'Walk-in Customer', invoiceDate: today, dueDate: today, currency: 'ZMW', lines } }
      );
      const invoiceResult = inv?.createSalesInvoice;
      if (!invoiceResult?.ok) throw new Error(invoiceResult?.error || 'Failed to create invoice');
      const invoiceId = invoiceResult.invoice?.id;
      const invoiceNumber = invoiceResult.invoice?.invoiceNumber || 'POS-SALE';
      // 2. Post invoice
      await gql<any>(`mutation($id:UUID!){postSalesInvoice(invoiceId:$id,paymentMode:"cash"){ok error}}`, { id: invoiceId });
      // 3. Record payment
      await gql<any>(
        `mutation($id:UUID!,$a:Decimal!,$m:String!,$r:String){recordCashSaleReceipt(invoiceId:$id,amount:$a,paymentMethod:$m,reference:$r){ok error}}`,
        { id: invoiceId, a: total.toFixed(2), m: payMethod, r: reference || undefined }
      );
      setLastReceipt({ receiptNumber: invoiceNumber, items: [...cart], subtotal, tax, total, method: payMethod, change });
      setCart([]); setShowPayment(false); setCashReceived(''); setReference('');
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setProcessing(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={NAVY} /></View>;

  // Receipt screen
  if (lastReceipt) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
        <View style={s.receiptCard}>
          <View style={s.receiptHeader}>
            <Text style={s.receiptTick}>✓</Text>
            <Text style={s.receiptTitle}>Payment Successful</Text>
            <Text style={s.receiptNum}>{lastReceipt.receiptNumber}</Text>
          </View>
          <View style={s.receiptBody}>
            {lastReceipt.items.map((item: CartItem) => (
              <View key={item.product.id} style={s.receiptRow}>
                <Text style={s.receiptItem}>{item.product.name} × {item.qty}</Text>
                <Text style={s.receiptAmt}>{fmt(item.price * item.qty)}</Text>
              </View>
            ))}
            <View style={s.divider} />
            <View style={s.receiptRow}><Text style={s.receiptLabel}>Subtotal</Text><Text style={s.receiptAmt}>{fmt(lastReceipt.subtotal)}</Text></View>
            <View style={s.receiptRow}><Text style={s.receiptLabel}>VAT (16%)</Text><Text style={s.receiptAmt}>{fmt(lastReceipt.tax)}</Text></View>
            <View style={[s.receiptRow, { marginTop: 4 }]}><Text style={s.receiptTotal}>TOTAL</Text><Text style={s.receiptTotal}>{fmt(lastReceipt.total)}</Text></View>
            {lastReceipt.method === 'cash' && lastReceipt.change > 0 && (
              <View style={s.receiptRow}><Text style={[s.receiptLabel, { color: GREEN }]}>Change</Text><Text style={[s.receiptAmt, { color: GREEN }]}>{fmt(lastReceipt.change)}</Text></View>
            )}
          </View>
        </View>
        <TouchableOpacity style={s.newSaleBtn} onPress={() => setLastReceipt(null)}>
          <Text style={s.newSaleTxt}>New Sale</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      {/* Search Bar */}
      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products…"
          placeholderTextColor="#9CA3AF"
        />
        {cart.length > 0 && (
          <TouchableOpacity style={s.cartBtn} onPress={() => setShowCart(true)}>
            <Text style={s.cartBtnTxt}>Cart ({cartCount})</Text>
            <Text style={s.cartBtnAmt}>{fmt(total)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {categories.map(cat => (
          <TouchableOpacity key={cat} style={[s.catChip, activeCategory === cat && s.catChipActive]} onPress={() => setActiveCategory(cat)} activeOpacity={0.7}>
            <Text style={[s.catChipTxt, activeCategory === cat && s.catChipTxtActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Product Grid */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid}>
        {filtered.length === 0 ? (
          <Text style={s.empty}>No products found</Text>
        ) : filtered.map(p => {
          const inCart = cart.find(i => i.product.id === p.id);
          const outOfStock = p.stockLevel !== null && p.stockLevel <= 0;
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.productCard, outOfStock && s.productCardDisabled]}
              onPress={() => !outOfStock && addToCart(p)}
              activeOpacity={outOfStock ? 1 : 0.7}
            >
              <View style={s.productIcon}>
                <Text style={s.productIconTxt}>{p.name?.[0]?.toUpperCase()}</Text>
              </View>
              <Text style={s.productName} numberOfLines={2}>{p.name}</Text>
              <Text style={s.productPrice}>{fmt(p.unitPrice)}</Text>
              {p.stockLevel != null && (
                <Text style={[s.productStock, p.stockLevel <= 5 && { color: '#DC2626' }]}>
                  {outOfStock ? 'Out of stock' : `Stock: ${p.stockLevel}`}
                </Text>
              )}
              {inCart && (
                <View style={s.inCartBadge}>
                  <Text style={s.inCartTxt}>{inCart.qty}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Cart Modal */}
      <Modal visible={showCart} animationType="slide" onRequestClose={() => setShowCart(false)}>
        <View style={s.cartHeader}>
          <Text style={s.cartTitle}>Cart</Text>
          <TouchableOpacity onPress={() => setShowCart(false)}><Text style={s.cartClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
          {cart.map((item, i) => (
            <View key={item.product.id} style={[s.cartItem, i > 0 && { marginTop: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.cartItemName}>{item.product.name}</Text>
                <Text style={s.cartItemPrice}>{fmt(item.price)} each</Text>
              </View>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.product.id, item.qty - 1)}><Text style={s.qtyBtnTxt}>−</Text></TouchableOpacity>
                <Text style={s.qtyTxt}>{item.qty}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.product.id, item.qty + 1)}><Text style={s.qtyBtnTxt}>+</Text></TouchableOpacity>
              </View>
              <Text style={s.cartItemTotal}>{fmt(item.price * item.qty)}</Text>
            </View>
          ))}
          {cart.length > 0 && (
            <View style={s.summaryCard}>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Subtotal</Text><Text style={s.summaryAmt}>{fmt(subtotal)}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>VAT (16%)</Text><Text style={s.summaryAmt}>{fmt(tax)}</Text></View>
              <View style={[s.summaryRow, s.totalRow]}><Text style={s.totalLabel}>Total</Text><Text style={s.totalAmt}>{fmt(total)}</Text></View>
            </View>
          )}
        </ScrollView>
        {cart.length > 0 && (
          <View style={s.checkoutBar}>
            <TouchableOpacity style={s.clearBtn} onPress={() => { setCart([]); setShowCart(false); }}>
              <Text style={s.clearBtnTxt}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.checkoutBtn} onPress={() => { setShowCart(false); setShowPayment(true); }}>
              <Text style={s.checkoutBtnTxt}>Pay {fmt(total)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayment} animationType="slide" onRequestClose={() => setShowPayment(false)}>
        <View style={s.cartHeader}>
          <Text style={s.cartTitle}>Payment</Text>
          <TouchableOpacity onPress={() => setShowPayment(false)}><Text style={s.cartClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9', padding: 16 }}>
          <View style={s.payTotal}><Text style={s.payTotalLabel}>Total Due</Text><Text style={s.payTotalAmt}>{fmt(total)}</Text></View>

          <Text style={s.paySection}>Payment Method</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {[{ label: 'Cash', value: 'cash' }, { label: 'Card', value: 'card' }, { label: 'Mobile Money', value: 'mobile_money' }].map(m => (
              <TouchableOpacity key={m.value} style={[s.methodBtn, payMethod === m.value && s.methodBtnActive]} onPress={() => setPayMethod(m.value)}>
                <Text style={[s.methodTxt, payMethod === m.value && s.methodTxtActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {payMethod === 'cash' && (
            <>
              <Text style={s.paySection}>Cash Received</Text>
              <TextInput
                style={s.payInput}
                value={cashReceived}
                onChangeText={setCashReceived}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="#9CA3AF"
              />
              {parseFloat(cashReceived || '0') >= total && (
                <View style={s.changeBox}>
                  <Text style={s.changeLabel}>Change</Text>
                  <Text style={s.changeAmt}>{fmt(change)}</Text>
                </View>
              )}
            </>
          )}

          {payMethod !== 'cash' && (
            <>
              <Text style={s.paySection}>Reference / Transaction ID</Text>
              <TextInput style={s.payInput} value={reference} onChangeText={setReference} placeholder="Transaction reference" placeholderTextColor="#9CA3AF" />
            </>
          )}
        </ScrollView>
        <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
          <TouchableOpacity style={[s.processBtn, processing && { opacity: 0.5 }]} onPress={processPayment} disabled={processing}>
            <Text style={s.processBtnTxt}>{processing ? 'Processing…' : `Confirm Payment · ${fmt(total)}`}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Floating cart button when cart has items and cart modal is not open */}
      {cart.length > 0 && !showCart && !showPayment && (
        <TouchableOpacity style={s.floatingCart} onPress={() => setShowCart(true)} activeOpacity={0.9}>
          <Text style={s.floatingCartCount}>{cartCount}</Text>
          <Text style={s.floatingCartTxt}>View Cart</Text>
          <Text style={s.floatingCartAmt}>{fmt(total)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 40, fontSize: 14 },

  searchBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  searchInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827' },
  cartBtn: { backgroundColor: NAVY, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  cartBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cartBtnAmt: { color: GOLD, fontSize: 13, fontWeight: '800' },

  catScroll: { maxHeight: 48, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  catChip: { height: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', justifyContent: 'center', alignSelf: 'center' },
  catChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  catChipTxt: { fontSize: 13, color: '#374151', fontWeight: '500' },
  catChipTxtActive: { color: '#fff', fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8 },
  productCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  productCardDisabled: { opacity: 0.5 },
  productIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  productIconTxt: { fontSize: 18, fontWeight: '700', color: '#4F46E5' },
  productName: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  productPrice: { fontSize: 15, fontWeight: '800', color: NAVY },
  productStock: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  inCartBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center' },
  inCartTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },

  cartHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  cartTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: NAVY },
  cartClose: { fontSize: 20, color: '#6B7280', padding: 4 },

  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16 },
  cartItemName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  cartItemPrice: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cartItemTotal: { fontSize: 14, fontWeight: '700', color: NAVY, marginLeft: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  qtyBtnTxt: { fontSize: 18, color: NAVY, lineHeight: 22 },
  qtyTxt: { fontSize: 16, fontWeight: '700', color: '#1F2937', minWidth: 20, textAlign: 'center' },

  summaryCard: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 16, padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryAmt: { fontSize: 14, color: '#1F2937', fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 6, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: NAVY },
  totalAmt: { fontSize: 18, fontWeight: '900', color: NAVY },

  checkoutBar: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  clearBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  clearBtnTxt: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  checkoutBtn: { flex: 1, backgroundColor: NAVY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  checkoutBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  payTotal: { backgroundColor: NAVY, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  payTotalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  payTotalAmt: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 4 },
  paySection: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  payInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18, fontWeight: '700', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  methodBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  methodBtnActive: { backgroundColor: NAVY, borderColor: NAVY },
  methodTxt: { fontSize: 13, color: '#374151', fontWeight: '600' },
  methodTxtActive: { color: '#fff' },
  changeBox: { backgroundColor: '#DCFCE7', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeLabel: { fontSize: 15, fontWeight: '700', color: GREEN },
  changeAmt: { fontSize: 22, fontWeight: '900', color: GREEN },

  processBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  processBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  floatingCart: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: NAVY, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  floatingCartCount: { backgroundColor: GOLD, borderRadius: 12, width: 26, height: 26, textAlign: 'center', lineHeight: 26, fontSize: 13, fontWeight: '800', color: '#fff', marginRight: 10 },
  floatingCartTxt: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  floatingCartAmt: { color: GOLD, fontSize: 16, fontWeight: '900' },

  receiptCard: { backgroundColor: '#fff', borderRadius: 20, margin: 16, marginTop: 32, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  receiptHeader: { backgroundColor: GREEN, padding: 28, alignItems: 'center' },
  receiptTick: { fontSize: 36, color: '#fff' },
  receiptTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 8 },
  receiptNum: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  receiptBody: { padding: 20 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  receiptItem: { fontSize: 13, color: '#374151' },
  receiptLabel: { fontSize: 13, color: '#6B7280' },
  receiptAmt: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  receiptTotal: { fontSize: 16, fontWeight: '800', color: NAVY },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 10 },
  newSaleBtn: { backgroundColor: NAVY, borderRadius: 14, margin: 16, paddingVertical: 16, alignItems: 'center' },
  newSaleTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
