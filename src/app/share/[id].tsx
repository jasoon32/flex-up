import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getWorkoutRecap, type WorkoutRecap } from '@/data/achievements';
import { useI18n } from '@/i18n';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { readLook } from '@/lib/character';
import { FRAME_COUNT, FRAME_MS } from '@/lib/poses';
import { copyStill, nextPaint, sendPrepared, shareGif, shareStill, type GifOptions, type ShareResult } from '@/lib/shareImage';
import { useAuth } from '@/providers/AuthProvider';
import { Button, ErrorBanner, Loading, styles } from '@/components/ui';
import { useRepFrame } from '@/components/AnimatedLifter';
import { CharacterCard, PhotoCard, StatsCard, StickerCard } from '@/components/ShareCards';
import { colors, fonts, space } from '@/theme';

/** Three rep loops: long enough for the numbers to count up and the lifter to do a few reps. */
const CARD_GIF: GifOptions = { frames: FRAME_COUNT * 3, delay: FRAME_MS, colors: 128 };
/** One rep loop, small and few colours: a sticker WeChat accepts. */
const STICKER_GIF: GifOptions = {
  frames: FRAME_COUNT,
  delay: FRAME_MS,
  size: { width: 240, height: 240 },
  colors: 64,
  name: 'flex-up-sticker.gif',
};

const PHOTO = 2;
const STICKER = 3;

/** Pick a card style, background and format (moving GIF or still image) and send it anywhere. */
export default function Share() {
  const { t } = useI18n();
  const S = t.share;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const look = readLook(session?.user);
  const { width, height } = useWindowDimensions();
  const [recap, setRecap] = useState<WorkoutRecap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState(0);
  const [format, setFormat] = useState<0 | 1>(0);
  const [clear, setClear] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** While recording or copying, this sets the frame instead of the clock (`null` = the still). */
  const [forced, setForced] = useState<number | null | undefined>(undefined);
  const tick = useRepFrame(busy !== null);
  const cardRef = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    let active = true;
    getWorkoutRecap(id)
      .then((r) => active && setRecap(r))
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [id]);

  const sticker = style === STICKER;
  const gifOpts = sticker ? STICKER_GIF : CARD_GIF;
  // A photo card is its own background, so it's never transparent.
  const transparent = clear && style !== PHOTO;
  // Fit a 9:16 card (or the square sticker) between the pickers and the buttons.
  const cardW = sticker
    ? Math.min(width - space.xl * 2, 260)
    : Math.round(Math.min(width - space.xl * 2, 380, ((height - 430) * 9) / 16));
  // The preview replays the count-up each time the GIF would loop.
  const frame = forced !== undefined ? forced : format === 1 ? null : tick % gifOpts.frames;

  const pickPhoto = async (camera: boolean) => {
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert(S.addPhoto, S.cameraDenied);
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.85 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const share = async () => {
    setBusy(S.sharing);
    try {
      let result;
      if (format === 1) {
        setForced(null);
        await nextPaint();
        result = await shareStill(cardRef, S.dialogTitle);
      } else {
        result = await shareGif(cardRef, setForced, { ...gifOpts, transparent }, S.dialogTitle, (n) =>
          setBusy(S.making(n, gifOpts.frames)),
        );
      }
      if (result === 'unavailable') Alert.alert(S.share, S.notAvailable);
      // Making the image outlasted the tap on iPhone: one more tap opens the share sheet.
      if (result === 'ready') {
        Alert.alert(S.ready, S.readyMsg, [
          { text: t.common.cancel, style: 'cancel' },
          {
            text: S.share,
            onPress: () => {
              sendPrepared().then(
                (r: ShareResult) => r === 'unavailable' && Alert.alert(S.share, S.notAvailable),
                (e) => Alert.alert(S.couldntShare, errorMessage(e)),
              );
            },
          },
        ]);
      }
    } catch (e) {
      Alert.alert(S.couldntShare, errorMessage(e));
    } finally {
      setForced(undefined);
      setBusy(null);
    }
  };

  /** Copies the still as a PNG for pasting into an Instagram Story as a sticker. */
  const copy = async () => {
    setBusy(S.sharing);
    try {
      // Nothing may be awaited before copyStill: on the web it must reach the clipboard during the tap.
      const ok = await copyStill(cardRef, async () => {
        setForced(null);
        await nextPaint();
      });
      if (ok) Alert.alert(S.copied, S.copiedMsg);
      else Alert.alert(S.copySticker, S.copyFailed);
    } finally {
      setForced(undefined);
      setBusy(null);
    }
  };

  if (!recap) {
    return error ? (
      <View style={[styles.screen, { padding: space.xl }]}>
        <ErrorBanner message={error} />
      </View>
    ) : (
      <Loading />
    );
  }

  const needsPhoto = style === PHOTO && !photo;
  const tabs = (labels: string[], value: number, onPick: (i: number) => void, disabled = false) => (
    <View style={[s.tabs, disabled && { opacity: 0.4 }]} accessibilityRole="tablist">
      {labels.map((label, i) => (
        <Pressable
          key={label}
          onPress={() => onPick(i)}
          disabled={busy !== null || disabled}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === i, disabled }}
          style={[s.tab, value === i && s.tabOn]}
        >
          <Text style={[s.tabText, value === i && { color: colors.onInk }]} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const cardProps = { recap, look, width: cardW, frame, transparent };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ title: S.title }} />
      <ScrollView contentContainerStyle={s.content}>
        {tabs(S.styles, style, setStyle)}
        {tabs(S.formats, format, (i) => setFormat(i as 0 | 1))}
        {tabs(S.backgrounds, transparent ? 1 : 0, (i) => setClear(i === 1), style === PHOTO)}
        <Text style={[styles.small, { marginTop: -space.xs }]}>
          {transparent ? S.transparentHint : S.formatHint[format]}
        </Text>

        {/* A two-tone backdrop shows how a transparent card reads on light and dark photos. */}
        <View style={[s.backdrop, transparent && s.backdropOn]}>
          {transparent ? (
            <>
              <View style={[StyleSheet.absoluteFill, { bottom: '50%', backgroundColor: '#DADAD2' }]} />
              <View style={[StyleSheet.absoluteFill, { top: '50%', backgroundColor: '#3A3A36' }]} />
            </>
          ) : null}
          <View ref={cardRef} collapsable={false}>
            {style === 0 ? <CharacterCard {...cardProps} /> : null}
            {style === 1 ? <StatsCard {...cardProps} /> : null}
            {style === PHOTO ? <PhotoCard {...cardProps} photo={photo} /> : null}
            {sticker ? <StickerCard {...cardProps} /> : null}
          </View>
        </View>

        {style === PHOTO ? (
          <View style={styles.row}>
            {Platform.OS !== 'web' ? (
              <Button
                title={S.takePhoto}
                variant="secondary"
                small
                icon={<Ionicons name="camera-outline" size={16} color={colors.ink} />}
                onPress={() => pickPhoto(true)}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              title={photo ? S.changePhoto : S.choosePhoto}
              variant="secondary"
              small
              icon={<Ionicons name="images-outline" size={16} color={colors.ink} />}
              onPress={() => pickPhoto(false)}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={s.actions}>
        {transparent ? (
          <Button
            title={S.copySticker}
            variant="secondary"
            icon={<Ionicons name="copy-outline" size={18} color={colors.ink} />}
            onPress={copy}
            disabled={busy !== null}
          />
        ) : null}
        <Button
          title={busy ?? S.share}
          icon={busy ? undefined : <Ionicons name="share-outline" size={18} color={colors.lime} />}
          onPress={share}
          disabled={busy !== null || needsPhoto}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.md },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    height: 40,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
  backdrop: { alignSelf: 'center', borderRadius: 24, overflow: 'hidden' },
  backdropOn: { padding: 10 },
  actions: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm },
});
