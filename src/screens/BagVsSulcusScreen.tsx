import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Switch,
} from 'react-native';

// ── Hill reduction table ──────────────────────────────────────────────────────
// Reference: Hill WE. Adjusting intraocular lens power for sulcus fixation.
//            J Cataract Refract Surg 2003;29:756–759.
// ELP assumptions: bag = 5.20 mm · sulcus = 4.70 mm (0.50 mm more anterior)
const ROWS = [
  { label: '≤ +9.0 D',            max: 9.0,      reduction: 0.0 },
  { label: '+9.5 to +17.0 D',     max: 17.0,     reduction: 0.5 },
  { label: '+17.5 to +28.0 D',    max: 28.0,     reduction: 1.0 },
  { label: '+28.5 to +34.0 D',    max: 34.0,     reduction: 1.5 },
  { label: '≥ +34.5 D',           max: Infinity, reduction: 2.0 },
];

function getRow(bagPower: number) {
  return ROWS.find(r => bagPower <= r.max) ?? ROWS[ROWS.length - 1];
}

function roundHalf(n: number) {
  return Math.round(n * 2) / 2;
}

export default function BagVsSulcusScreen() {
  const [bagPower,     setBagPower]     = useState('');
  const [opticCapture, setOpticCapture] = useState(false);

  const bag     = parseFloat(bagPower);
  const hasValue = !isNaN(bag);

  const row        = hasValue ? getRow(bag) : null;
  const reduction  = opticCapture ? 0 : (row?.reduction ?? 0);
  const sulcusExact = hasValue ? bag - reduction : null;
  const sulcusRounded = sulcusExact !== null ? roundHalf(sulcusExact) : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Banner */}
      <View style={s.banner}>
        <Text style={s.bannerTitle}>Bag vs Sulcus IOL Power</Text>
        <Text style={s.bannerDesc}>
          When an IOL is placed in the ciliary sulcus it sits ~0.50 mm more anterior than
          in the capsular bag, increasing effective power. Use this table to select the
          correct sulcus power from your bag-targeted calculation.
        </Text>
      </View>

      {/* Input */}
      <Text style={s.sectionHeader}>Bag IOL Power</Text>
      <View style={s.card}>
        <Text style={s.label}>Calculated Bag IOL Power (D)</Text>
        <TextInput
          style={s.input}
          value={bagPower}
          onChangeText={setBagPower}
          keyboardType="decimal-pad"
          placeholder="e.g. 20.00"
          placeholderTextColor="#AAA"
        />
        <Text style={s.hint}>
          Enter the IOL power calculated for in-the-bag placement (from your biometer or formula).
        </Text>

        <View style={s.captureRow}>
          <View style={s.captureTextCol}>
            <Text style={s.captureLabel}>Optic Capture</Text>
            <Text style={s.captureHint}>
              Haptics in sulcus · optic through intact CCC
            </Text>
          </View>
          <Switch
            value={opticCapture}
            onValueChange={setOpticCapture}
            trackColor={{ false: '#DDD5BB', true: '#2A8A44' }}
            thumbColor="#fff"
          />
        </View>
        {opticCapture && (
          <View style={s.captureNote}>
            <Text style={s.captureNoteText}>
              ✓ Optic capture positions the optic posterior to the CCC — effectively the
              same depth as capsular bag placement. No power reduction is needed.
            </Text>
          </View>
        )}
      </View>

      {/* Result */}
      {hasValue && (
        <>
          <Text style={s.sectionHeader}>Recommended Sulcus IOL Power</Text>
          <View style={s.resultCard}>
            <View style={s.resultTopRow}>
              <View style={s.resultBlock}>
                <Text style={s.resultBlockLabel}>Reduction</Text>
                <Text style={s.resultBlockValue}>
                  {reduction === 0 ? 'None' : `−${reduction.toFixed(2)} D`}
                </Text>
              </View>
              <View style={s.resultDivider} />
              <View style={s.resultBlock}>
                <Text style={s.resultBlockLabel}>Bag Power</Text>
                <Text style={s.resultBlockValue}>{bag.toFixed(2)} D</Text>
              </View>
            </View>

            <View style={s.sulcusPowerBox}>
              <Text style={s.sulcusPowerLabel}>Sulcus IOL Power</Text>
              <Text style={s.sulcusPowerValue}>
                {sulcusRounded !== null ? `${sulcusRounded > 0 ? '+' : ''}${sulcusRounded.toFixed(2)} D` : '—'}
              </Text>
              {sulcusExact !== null && sulcusRounded !== sulcusExact && (
                <Text style={s.sulcusExactNote}>
                  Exact: {sulcusExact.toFixed(2)} D → rounded to nearest 0.50 D step
                </Text>
              )}
            </View>

            <Text style={s.resultHint}>
              {opticCapture
                ? 'Optic capture: use the same power as calculated for the bag.'
                : row
                  ? `Bag power ${bag.toFixed(2)} D falls in the "${row.label}" range → reduce by ${reduction.toFixed(2)} D.`
                  : ''}
            </Text>
          </View>

          {/* Adjacent powers */}
          {!opticCapture && sulcusRounded !== null && (
            <View style={s.adjacentCard}>
              <Text style={s.adjacentLabel}>Available Steps</Text>
              <View style={s.adjacentRow}>
                {[-1.0, -0.5, 0, 0.5, 1.0].map(offset => {
                  const power = sulcusRounded + offset;
                  const isBest = offset === 0;
                  return (
                    <View key={offset} style={[s.adjacentCell, isBest && s.adjacentCellBest]}>
                      <Text style={[s.adjacentCellText, isBest && s.adjacentCellTextBest]}>
                        {power > 0 ? '+' : ''}{power.toFixed(2)}
                      </Text>
                      {isBest && <Text style={s.adjacentBestTag}>Best</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </>
      )}

      {/* Reference table */}
      <Text style={s.sectionHeader}>Hill Reduction Table</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableCol1, s.tableHeaderText]}>Bag IOL Power</Text>
          <Text style={[s.tableCol2, s.tableHeaderText]}>Reduction</Text>
          <Text style={[s.tableCol2, s.tableHeaderText]}>Sulcus Power</Text>
        </View>
        {ROWS.map((r, i) => {
          const isActive = hasValue && !opticCapture && row === r;
          return (
            <View key={i} style={[s.tableRow, i % 2 !== 0 && s.tableRowAlt, isActive && s.tableRowActive]}>
              <Text style={[s.tableCol1, s.tableCell, isActive && s.tableCellActive]}>
                {r.label}
              </Text>
              <Text style={[s.tableCol2, s.tableCell, isActive && s.tableCellActive]}>
                {r.reduction === 0 ? '—' : `−${r.reduction.toFixed(1)} D`}
              </Text>
              <Text style={[s.tableCol2, s.tableCell, isActive && s.tableCellActive]}>
                Bag {r.reduction === 0 ? '(unchanged)' : `− ${r.reduction.toFixed(1)} D`}
              </Text>
            </View>
          );
        })}
        <View style={[s.tableRow, { backgroundColor: '#EEF8EF' }]}>
          <Text style={[s.tableCol1, s.tableCell, { color: '#2A8A44', fontWeight: '700' }]}>
            Optic Capture
          </Text>
          <Text style={[s.tableCol2, s.tableCell, { color: '#2A8A44' }]}>—</Text>
          <Text style={[s.tableCol2, s.tableCell, { color: '#2A8A44' }]}>Bag (unchanged)</Text>
        </View>
      </View>

      {/* Clinical notes */}
      <Text style={s.sectionHeader}>Clinical Notes</Text>
      <View style={s.notesCard}>
        <NoteItem
          icon="🔹"
          title="3-Piece IOL Required"
          body="Only 3-piece foldable IOLs (e.g. MA60AC, ZA9003) should be placed in the sulcus. Single-piece acrylic IOLs (e.g. SA60AT) are contraindicated in the sulcus — haptic rigidity can cause UGH syndrome (uveitis-glaucoma-hyphema)."
        />
        <NoteItem
          icon="🔹"
          title="Optic Capture — Preferred Technique"
          body="When the posterior capsule tear is central and the anterior CCC is intact, place haptics in the sulcus and prolapse the optic posterior to the CCC rim. This restores near-bag depth and eliminates power reduction. Most surgeons prefer this when feasible."
        />
        <NoteItem
          icon="🔹"
          title="ELP Assumptions"
          body="Hill's table is calculated with capsular bag ELP = 5.20 mm and ciliary sulcus ELP = 4.70 mm (0.50 mm more anterior). Actual ELP will vary with anatomic ACD."
        />
        <NoteItem
          icon="🔹"
          title="Negative-Power IOLs"
          body="For IOLs ≤ 0 D (high axial myopes), apply 0.0 D reduction — the vergence-based shift is negligible at these powers."
        />
        <NoteItem
          icon="📚"
          title="Reference"
          body="Hill WE. Adjusting intraocular lens power for sulcus fixation. J Cataract Refract Surg 2003;29:756–759."
        />
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function NoteItem({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={s.noteItem}>
      <Text style={s.noteIcon}>{icon}</Text>
      <View style={s.noteBody}>
        <Text style={s.noteTitle}>{title}</Text>
        <Text style={s.noteText}>{body}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },

  banner: {
    backgroundColor: '#0d0d1a', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  bannerTitle: { color: '#C8A84B', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  bannerDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17 },

  sectionHeader: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  hint: { color: '#888060', fontSize: 11, marginTop: 6, fontStyle: 'italic' },

  card: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  label: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase', marginBottom: 5,
  },
  input: {
    backgroundColor: '#FFFFFF', color: '#1A1200', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 18,
    borderWidth: 1, borderColor: '#DDD5BB', fontWeight: '600',
  },

  captureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#DDD5BB',
  },
  captureTextCol: { flex: 1, paddingRight: 12 },
  captureLabel: { color: '#1A1200', fontSize: 14, fontWeight: '600' },
  captureHint: { color: '#888060', fontSize: 11, marginTop: 2 },
  captureNote: {
    backgroundColor: '#EEF8EF', borderRadius: 8, padding: 10, marginTop: 10,
    borderWidth: 1, borderColor: '#88CC99',
  },
  captureNoteText: { color: '#1a5a2a', fontSize: 11, lineHeight: 16 },

  // Result card
  resultCard: {
    backgroundColor: '#0d0d1a', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#C8A84B',
  },
  resultTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  resultBlock: { flex: 1, alignItems: 'center' },
  resultBlockLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultBlockValue: { color: '#C8A84B', fontSize: 18, fontWeight: '700', marginTop: 2 },
  resultDivider: { width: 1, height: 36, backgroundColor: 'rgba(200,168,75,0.3)', marginHorizontal: 12 },

  sulcusPowerBox: {
    backgroundColor: 'rgba(200,168,75,0.12)', borderRadius: 10, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(200,168,75,0.3)',
  },
  sulcusPowerLabel: { color: '#C8A84B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  sulcusPowerValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginVertical: 4 },
  sulcusExactNote: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontStyle: 'italic' },
  resultHint: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 12, fontStyle: 'italic' },

  // Adjacent steps
  adjacentCard: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB', marginTop: 10,
  },
  adjacentLabel: {
    color: '#888060', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  adjacentRow: { flexDirection: 'row', gap: 6 },
  adjacentCell: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD5BB',
  },
  adjacentCellBest: { backgroundColor: '#C8A84B', borderColor: '#C8A84B' },
  adjacentCellText: { color: '#1A1200', fontSize: 13, fontWeight: '600' },
  adjacentCellTextBest: { color: '#FFFFFF' },
  adjacentBestTag: { color: 'rgba(255,255,255,0.8)', fontSize: 8, marginTop: 1, fontWeight: '700' },

  // Reference table
  table: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#EDE9DE',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  tableHeaderText: { color: '#888060', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  tableRowAlt: { backgroundColor: '#F8F6EF' },
  tableRowActive: { backgroundColor: '#FFF8E8', borderLeftWidth: 3, borderLeftColor: '#C8A84B' },
  tableCol1: { flex: 2, paddingRight: 8 },
  tableCol2: { flex: 1.5 },
  tableCell: { color: '#1A1200', fontSize: 13 },
  tableCellActive: { color: '#7a5010', fontWeight: '700' },

  // Notes
  notesCard: {
    backgroundColor: '#F8F6EF', borderRadius: 12,
    borderWidth: 1, borderColor: '#DDD5BB', overflow: 'hidden',
  },
  noteItem: {
    flexDirection: 'row', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#DDD5BB',
  },
  noteIcon: { fontSize: 14, marginRight: 10, marginTop: 1 },
  noteBody: { flex: 1 },
  noteTitle: { color: '#1A1200', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  noteText: { color: '#444040', fontSize: 12, lineHeight: 17 },
});
