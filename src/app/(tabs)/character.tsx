import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { validateName } from '@/lib/validation';
import {
  BODIES,
  CATALOG,
  DEFAULT_LOOK,
  GENDERS,
  ITEM_COUNT,
  isWomens,
  lookWith,
  readLook,
  saveLook,
  type CharacterLook,
  type GearId,
  type ItemId,
  type Slot,
} from '@/lib/character';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { Button, Eyebrow, TextField, styles } from '@/components/ui';
import { PixelCharacter } from '@/components/PixelCharacter';
import { colors, fonts, radius, space } from '@/theme';

export default function Character() {
  const { t } = useI18n();
  const C = t.character;
  const { session } = useAuth();
  const saved = readLook(session?.user);
  const [draft, setDraft] = useState<CharacterLook>(saved);
  const [slot, setSlot] = useState<Slot>('top');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pick up the saved look once the account loads or changes (e.g. saved on another device).
  const savedKey = JSON.stringify(saved);
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (syncedKey !== savedKey) {
    setSyncedKey(savedKey);
    setDraft(saved);
  }

  const dirty = JSON.stringify({ ...draft, name: draft.name.trim() }) !== savedKey;
  const set = <K extends keyof CharacterLook>(key: K, value: CharacterLook[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isOn = (s: Slot, id: ItemId) => (s === 'gear' ? draft.gear.includes(id as GearId) : draft[s] === id);

  /** Tap to wear, tap again to take off. Tops and bottoms are always worn, so they only switch. */
  const toggle = (s: Slot, id: ItemId) => {
    const on = isOn(s, id);
    if (s === 'gear') {
      const g = id as GearId;
      return set('gear', on ? draft.gear.filter((x) => x !== g) : [...draft.gear, g]);
    }
    if (s === 'top' || s === 'bottom') return on ? undefined : setDraft((d) => ({ ...d, [s]: id }));
    setDraft((d) => ({ ...d, [s]: on ? null : id }));
  };

  const save = async () => {
    const err = draft.name.trim() ? validateName(draft.name, C.name) : null;
    setNameError(err);
    if (err) return;
    setSaving(true);
    try {
      await saveLook(draft);
    } catch (e) {
      Alert.alert(C.couldntSave, errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const chips = <T extends string>(label: string, options: readonly T[], value: T, onPick: (v: T) => void, name: (v: T) => string) => (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Eyebrow>{label}</Eyebrow>
      <View style={s.options}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable
              key={o}
              onPress={() => onPick(o)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[s.option, on && s.optionOn]}
            >
              <Text style={[s.optionText, on && { color: colors.onInk }]}>{name(o)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const section = CATALOG.find((c) => c.slot === slot)!;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { gap: space.xl }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{C.title}</Text>

          <View style={s.stage}>
            <View style={s.floor} />
            <PixelCharacter pixel={7} look={draft} />
          </View>
          <View style={[styles.between, { marginTop: -space.sm }]}>
            <Text style={s.name} numberOfLines={1}>
              {draft.name.trim() || C.defaultName}
            </Text>
            <Text style={styles.small}>{C.bodies[draft.body]}</Text>
          </View>

          <TextField
            label={C.name}
            value={draft.name}
            onChangeText={(v) => {
              set('name', v);
              if (nameError) setNameError(null);
            }}
            placeholder={C.namePlaceholder}
            maxLength={60}
            autoCapitalize="words"
            returnKeyType="done"
            error={nameError}
          />

          {chips(C.gender, GENDERS, draft.gender, (v) => set('gender', v), (v) => C.genders[v])}
          {chips(C.body, BODIES, draft.body, (v) => set('body', v), (v) => C.bodies[v])}

          <View style={{ gap: 10 }}>
            <View style={styles.between}>
              <Eyebrow>{C.catalog}</Eyebrow>
              <Pressable onPress={() => setDraft((d) => ({ ...DEFAULT_LOOK, name: d.name, gender: d.gender, body: d.body }))} accessibilityRole="button" hitSlop={8}>
                <Text style={s.link}>{C.basics}</Text>
              </Pressable>
            </View>
            <Text style={styles.small}>{C.catalogCount(ITEM_COUNT)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="tablist">
              {CATALOG.map((c) => {
                const on = c.slot === slot;
                return (
                  <Pressable
                    key={c.slot}
                    onPress={() => setSlot(c.slot)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[s.option, on && s.optionOn]}
                  >
                    <Text style={[s.optionText, on && { color: colors.onInk }]}>{C.slots[c.slot]}</Text>
                    <Text style={[s.count, on && { color: colors.lime }]}>{c.items.length}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {slot === 'gear' ? <Text style={styles.small}>{C.gearHint}</Text> : null}
            <View style={s.grid}>
              {section.items.map((id) => {
                const on = isOn(slot, id);
                const name = C.items[id] + (isWomens(id) ? ` (${C.womens})` : '');
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggle(slot, id)}
                    accessibilityRole={slot === 'gear' || section.optional ? 'checkbox' : 'radio'}
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={name}
                    style={[s.item, on && s.itemOn]}
                  >
                    <View style={s.itemArt}>
                      <PixelCharacter pixel={3} look={lookWith(draft, slot, id)} label={name} />
                      {on ? (
                        <View style={s.check}>
                          <Ionicons name="checkmark" size={12} color={colors.lime} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.itemName} numberOfLines={2}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: space.sm }}>
            <Button
              title={dirty ? C.save : C.saved}
              icon={dirty ? undefined : <Ionicons name="checkmark" size={18} color={colors.onInk} />}
              onPress={save}
              loading={saving}
              disabled={!dirty}
            />
            {dirty ? <Text style={[styles.small, { textAlign: 'center' }]}>{C.unsaved}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  stage: {
    height: 300,
    borderRadius: radius.xl,
    backgroundColor: '#DEDED6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floor: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 34,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CACAC1',
  },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, flexShrink: 1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionOn: { backgroundColor: colors.ink, borderColor: colors.ink, borderWidth: 2 },
  optionText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  count: { fontSize: 12, fontFamily: fonts.semibold, color: colors.muted },
  link: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink, textDecorationLine: 'underline' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    width: '31.5%',
    padding: 6,
    paddingBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 6,
  },
  itemOn: { borderWidth: 2, borderColor: colors.ink, padding: 5, paddingBottom: 9 },
  itemArt: {
    height: 104,
    borderRadius: 10,
    backgroundColor: '#CFCFC6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: 12, lineHeight: 15, fontFamily: fonts.semibold, color: colors.ink },
});
