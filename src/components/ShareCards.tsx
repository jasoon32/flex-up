import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPr, type WorkoutRecap } from '@/data/achievements';
import { locale, strings, useI18n } from '@/i18n';
import type { CharacterLook } from '@/lib/character';
import { FRAME_COUNT, isHeavy, poseFor } from '@/lib/poses';
import type { SessionSet } from '@/lib/types';
import { AnimatedLifter } from '@/components/AnimatedLifter';
import { pbIcon, PbIcons, PixelIcon } from '@/components/PixelBadge';
import { toKg } from '@/lib/units';
import { colors, fonts, WEIGHT_UNIT } from '@/theme';
import { trName } from '@/data/names';

/**
 * Share cards. Sizes scale from a 360-wide design. Everything that moves is driven by
 * `frame`, so a GIF can capture the cards frame by frame; `null` shows the still version
 * (finished numbers, hardest point of the rep). `transparent` drops the backgrounds so the
 * card floats over a photo, with outlined text that reads on anything.
 */
interface CardProps {
  recap: WorkoutRecap;
  look: CharacterLook;
  width: number;
  frame: number | null;
  transparent?: boolean;
}

/** Frames the numbers take to count up. */
export const COUNT_FRAMES = 8;
const PEAK = 3;

const storyHeight = (w: number) => Math.round((w * 16) / 9);

/** 0 → 1 over the first COUNT_FRAMES frames, easing out. */
function progress(frame: number | null) {
  if (frame === null) return 1;
  const p = Math.min(1, frame / COUNT_FRAMES);
  return 1 - (1 - p) ** 3;
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Heaviest set of an exercise (most reps breaks ties, and wins when there's no weight). */
function topSet(sets: SessionSet[]): SessionSet {
  return sets.reduce((a, b) => {
    const aw = toKg(a.weight ?? 0, a.weight_unit);
    const bw = toKg(b.weight ?? 0, b.weight_unit);
    return bw > aw || (bw === aw && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a;
  });
}

const num = (n: number) => Math.round(n).toLocaleString(locale());

/** A dark outline so light text stays readable on any photo behind a transparent card. */
const outline = (on: boolean | undefined, k: number): TextStyle | null =>
  on ? { textShadowColor: '#000000', textShadowRadius: 6 * k, textShadowOffset: { width: 0, height: 0 } } : null;

function Brand({ color, k, transparent }: { color: string; k: number; transparent?: boolean }) {
  return (
    <Text style={[{ fontFamily: fonts.display, fontSize: 14 * k, letterSpacing: 1, color }, outline(transparent, k)]}>
      FLEX UP
    </Text>
  );
}

/** The streak's pixel lightning bolt flickers between two colours. */
function Bolt({ frame, k }: { frame: number | null; k: number }) {
  const hot = frame !== null && frame % 2 === 1;
  const color = hot ? '#F7E07A' : colors.lime;
  return <PixelIcon name="bolt" size={16 * k} color={color} accent={color} />;
}

/** Pixel trophies and flames for the records broken and matched; nothing when there are none. */
function PbRow({ recap, k, size = 22, transparent }: { recap: WorkoutRecap; k: number; size?: number; transparent?: boolean }) {
  return (
    <PbIcons
      prs={recap.prs}
      size={size * k}
      gap={3 * k}
      color={colors.onInk}
      accent={colors.lime}
      countStyle={outline(transparent, k) ?? undefined}
    />
  );
}

/** "trophy ×2   flame ×1": how many records were broken and matched in the workout; nothing when there are none. */
function PbCount({ recap, k, transparent }: { recap: WorkoutRecap; k: number; transparent?: boolean }) {
  const broken = recap.prs.filter((p) => !p.matched).length;
  const matched = recap.prs.length - broken;
  if (broken + matched === 0) return null;
  const ink = transparent ? colors.onInk : colors.ink;
  const text = [{ fontSize: 22 * k, fontFamily: fonts.bold, color: ink }, outline(transparent, k)];
  const S = strings().celebrate;
  const label = [broken ? S.pbBroken(broken) : '', matched ? S.pbMatched(matched) : ''].filter(Boolean).join(', ');
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 * k }}>
      {(
        [
          ['trophy', broken],
          ['flame', matched],
        ] as const
      ).map(([name, n]) =>
        n ? (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * k }}>
            <PixelIcon name={name} size={24 * k} color={ink} accent={colors.lime} />
            <Text style={text}>{`×${n}`}</Text>
          </View>
        ) : null,
      )}
    </View>
  );
}

const FIRE = ['#FF3B30', '#FF6A2B', '#FF9500', '#FFC23D', '#FF9500', '#FF6A2B'];

/** Text whose letters cycle through the rainbow (broken PB) or flame colours (matched PB) as `frame` advances. */
function FxText({ text, fx, frame, style }: { text: string; fx: 'rainbow' | 'fire'; frame: number | null; style: TextStyle }) {
  const f = frame ?? 0;
  return (
    <Text style={style} numberOfLines={1}>
      {[...text].map((ch, i) => (
        <Text key={i} style={{ color: fx === 'rainbow' ? `hsl(${(i * 28 + f * 45) % 360}, 90%, 62%)` : FIRE[(i + f) % FIRE.length] }}>
          {ch}
        </Text>
      ))}
    </Text>
  );
}

function PanelStat({
  value,
  label,
  k,
  icon,
  transparent,
}: {
  value: string;
  label: string;
  k: number;
  icon?: ReactNode;
  transparent?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 * k, height: 28 * k }}>
        {icon}
        <Text style={[{ fontFamily: fonts.display, fontSize: 22 * k, color: colors.lime }, outline(transparent, k)]}>
          {value}
        </Text>
      </View>
      <Text
        style={[{ fontFamily: fonts.medium, fontSize: 11 * k, color: transparent ? colors.onInk : colors.onInkMuted }, outline(transparent, k)]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const poseOf = (recap: WorkoutRecap) => poseFor(recap.session.plan_name, recap.done.map((g) => g.name));
const heavyOf = (recap: WorkoutRecap) =>
  isHeavy(recap.done.flatMap((g) => g.sets.map((s) => toKg(s.weight ?? 0, s.weight_unit))));

export function CharacterCard({ recap, look, width, frame, transparent }: CardProps) {
  const { t } = useI18n();
  const S = t.share;
  const k = width / 360;
  const p = progress(frame);
  const pose = poseOf(recap);
  const name = look.name.trim() || t.character.defaultName;
  const ink = transparent ? colors.onInk : colors.ink;
  const stageW = width - 48 * k;
  const stageH = storyHeight(width) * 0.48;
  return (
    <View
      style={[
        s.card,
        { width, height: storyHeight(width), backgroundColor: transparent ? 'transparent' : colors.lime, padding: 24 * k },
      ]}
    >
      <Text style={[s.eyebrow, { fontSize: 12 * k, color: ink }, outline(transparent, k)]}>
        {`${dateLabel(recap.session.started_at)} · ${trName(recap.session.plan_name, 'plan')}`.toLocaleUpperCase(locale())}
      </Text>
      <Text style={[s.title, { fontSize: 36 * k, lineHeight: 40 * k, color: ink }, outline(transparent, k)]}>
        {S.done(trName(recap.session.plan_name, 'plan'))}
      </Text>
      <PbCount recap={recap} k={k} transparent={transparent} />
      {/* A dark stage keeps lime outfits from blending into the lime card. */}
      <View
        style={[
          s.stage,
          { marginVertical: 12 * k, borderRadius: 20 * k, backgroundColor: transparent ? 'transparent' : colors.inkRaised },
        ]}
      >
        <AnimatedLifter
          look={look}
          pose={pose}
          heavy={heavyOf(recap)}
          frame={frame ?? PEAK}
          maxWidth={stageW - 40 * k}
          maxHeight={stageH - 70 * k}
        />
        <Text
          style={[{ fontSize: 14 * k, fontFamily: fonts.semibold, color: colors.lime, marginTop: 10 * k }, outline(transparent, k)]}
        >
          {S.poses[pose](name)}
        </Text>
      </View>
      <View
        style={[s.panel, { borderRadius: 16 * k, padding: 14 * k, backgroundColor: transparent ? 'transparent' : colors.ink }]}
      >
        <PanelStat k={k} transparent={transparent} value={num(recap.done.length * p)} label={S.exercises} />
        <PanelStat k={k} transparent={transparent} value={num(recap.volume * p)} label={S.kgMoved(WEIGHT_UNIT)} />
        <PanelStat
          k={k}
          transparent={transparent}
          value={num(recap.streakDays * p)}
          label={S.streak}
          icon={<Bolt frame={frame} k={k} />}
        />
      </View>
      <View style={{ alignItems: 'center', marginTop: 14 * k }}>
        <Brand color={ink} k={k} transparent={transparent} />
      </View>
    </View>
  );
}

export function StatsCard({ recap, width, frame, transparent }: CardProps) {
  const { t } = useI18n();
  const S = t.share;
  const k = width / 360;
  const p = progress(frame);
  const prs = new Map(recap.prs.map((pr) => [pr.exercise, pr]));
  const shown = recap.done.slice(0, 7);
  // Exercise rows appear one per frame after the headline has counted up.
  const visible = frame === null ? shown.length : Math.max(0, frame - 2);
  const o = outline(transparent, k);
  return (
    <View
      style={[
        s.card,
        { width, height: storyHeight(width), backgroundColor: transparent ? 'transparent' : colors.ink, padding: 26 * k },
      ]}
    >
      <Text style={[s.eyebrow, { fontSize: 12 * k, color: colors.lime }, o]}>
        {`${trName(recap.session.plan_name, 'plan')} · ${t.units.minutes(recap.minutes)}`.toLocaleUpperCase(locale())}
      </Text>
      <Text style={[s.title, { fontSize: 30 * k, lineHeight: 34 * k, color: colors.onInk, marginBottom: 6 * k }, o]}>
        {S.headline(Math.round(recap.completedSets * p), num(recap.volume * p), WEIGHT_UNIT)}
      </Text>
      <View style={{ marginBottom: 14 * k }}>
        <PbRow recap={recap} k={k} transparent={transparent} />
      </View>
      <View style={{ gap: 11 * k }}>
        {shown.map((g, i) => {
          const top = topSet(g.sets);
          const pr = prs.get(g.name);
          const lead =
            top.weight_unit === 'bw'
              ? top.weight
                ? `${t.units.bodyweight}+${top.weight}`
                : t.units.bodyweight
              : top.weight
                ? `${top.weight}${top.weight_unit === 'lb' ? ' lb' : ''}`
                : t.units.bodyweight;
          const value = `${lead} × ${top.reps ?? '–'}`;
          const rowText = { fontSize: 15 * k, fontFamily: fonts.semibold, ...outline(transparent, k) };
          return (
            <View
              key={g.name}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k, opacity: i < visible ? 1 : 0 }}
            >
              {pr ? (
                <>
                  {/* Broken PBs shimmer through the rainbow, matched ones burn red to yellow. */}
                  <PixelIcon name={pbIcon(pr)} size={16 * k} color={colors.onInk} accent={colors.lime} />
                  <FxText
                    text={trName(g.name)}
                    fx={pr.matched ? 'fire' : 'rainbow'}
                    frame={frame}
                    style={{ flex: 1, ...rowText }}
                  />
                  <FxText text={formatPr(pr)} fx={pr.matched ? 'fire' : 'rainbow'} frame={frame} style={rowText} />
                </>
              ) : (
                <>
                  <Text style={{ flex: 1, ...rowText, color: colors.onInk }} numberOfLines={1}>
                    {trName(g.name)}
                  </Text>
                  <Text style={{ ...rowText, color: transparent ? colors.onInk : colors.onInkMuted }}>{value}</Text>
                </>
              )}
            </View>
          );
        })}
        {recap.done.length > shown.length ? (
          <Text style={[{ fontSize: 14 * k, fontFamily: fonts.medium, color: colors.onInkMuted }, o]}>
            {S.more(recap.done.length - shown.length)}
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * k }}>
          {recap.week.map((d) => (
            <View
              key={d.day}
              style={{
                width: 18 * k,
                height: 18 * k,
                borderRadius: 9 * k,
                backgroundColor: d.done ? colors.lime : 'transparent',
                borderWidth: d.done ? 0 : 1.5,
                borderColor: d.planned ? colors.onInkMuted : colors.inkLine,
                borderStyle: d.planned ? 'solid' : 'dashed',
              }}
            />
          ))}
          <View style={{ marginLeft: 4 * k }}>
            <Bolt frame={frame} k={k} />
          </View>
        </View>
        <Brand color={colors.onInk} k={k} transparent={transparent} />
      </View>
    </View>
  );
}

export function PhotoCard({ recap, width, frame, photo }: CardProps & { photo: string | null }) {
  const { t } = useI18n();
  const S = t.share;
  const k = width / 360;
  const p = progress(frame);
  return (
    <View style={[s.card, { width, height: storyHeight(width), backgroundColor: colors.inkRaised }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
          <Ionicons name="camera-outline" size={48 * k} color={colors.onInkMuted} />
          <Text style={{ fontSize: 15 * k, fontFamily: fonts.semibold, color: colors.onInkMuted }}>{S.addPhoto}</Text>
        </View>
      )}
      <View style={{ position: 'absolute', top: 18 * k, left: 18 * k }}>
        <View style={{ backgroundColor: colors.lime, borderRadius: 8 * k, paddingHorizontal: 10 * k, paddingVertical: 5 * k }}>
          <Brand color={colors.ink} k={k} />
        </View>
      </View>
      <View style={[s.photoPanel, { left: 14 * k, right: 14 * k, bottom: 14 * k, borderRadius: 18 * k, padding: 16 * k }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[s.eyebrow, { fontSize: 11 * k, color: colors.lime }]}>
            {dateLabel(recap.session.started_at).toLocaleUpperCase(locale())}
          </Text>
          <PbRow recap={recap} k={k} size={16} />
        </View>
        <Text style={[s.title, { fontSize: 26 * k, lineHeight: 30 * k, color: colors.onInk }]} numberOfLines={1}>
          {S.done(trName(recap.session.plan_name, 'plan'))}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 10 * k }}>
          <PanelStat k={k} value={t.units.minutes(Math.round(recap.minutes * p))} label={t.celebrate.time} />
          <PanelStat k={k} value={num(recap.completedSets * p)} label={t.celebrate.sets(recap.completedSets)} />
          <PanelStat k={k} value={num(recap.streakDays * p)} label={S.streak} icon={<Bolt frame={frame} k={k} />} />
        </View>
      </View>
    </View>
  );
}

/**
 * A small square for WeChat-style stickers: the lifter doing the rep, the streak (bolt) top left
 * and the PBs (trophy broken, flame matched) top right. The PB badge turns lime and pops at the top of
 * every rep; badges only appear when there's something to show.
 */
export function StickerCard({ recap, look, width, frame, transparent }: CardProps) {
  const { t } = useI18n();
  const k = width / 240;
  const pose = poseOf(recap);
  const broken = recap.prs.some((p) => !p.matched);
  const streak = recap.streakDays >= 2 ? recap.streakDays : 0;
  const peak = frame !== null && frame % FRAME_COUNT === PEAK;
  const o = outline(transparent, k);
  const pill = {
    height: 30 * k,
    borderRadius: 15 * k,
    paddingHorizontal: 10 * k,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4 * k,
    backgroundColor: transparent ? 'rgba(17,17,17,0.82)' : '#232320',
  };
  return (
    <View
      style={{
        width,
        height: width,
        borderRadius: transparent ? 0 : 28 * k,
        backgroundColor: transparent ? 'transparent' : colors.ink,
        alignItems: 'center',
        padding: 12 * k,
      }}
    >
      <View style={{ alignSelf: 'stretch', height: 30 * k, flexDirection: 'row', justifyContent: 'space-between' }}>
        {streak ? (
          <View style={pill}>
            <Bolt frame={frame} k={k} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13 * k, color: colors.onInk }}>{streak}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11 * k, color: colors.onInkMuted }}>{t.share.streak}</Text>
          </View>
        ) : (
          <View />
        )}
        {recap.prs.length > 0 ? (
          <View style={[pill, broken && { backgroundColor: colors.lime }, { transform: [{ scale: peak ? 1.15 : 1 }] }]}>
            <PbIcons prs={recap.prs} size={16 * k} gap={2 * k} color={broken ? colors.ink : colors.onInk} accent={colors.lime} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatedLifter
          look={look}
          pose={pose}
          heavy={heavyOf(recap)}
          frame={frame ?? PEAK}
          maxWidth={width * 0.7}
          maxHeight={width * 0.52}
        />
      </View>
      <Text style={[{ fontFamily: fonts.display, fontSize: 20 * k, color: colors.lime }, o]} numberOfLines={1}>
        {t.share.done(trName(recap.session.plan_name, 'plan'))}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden' },
  eyebrow: { fontFamily: fonts.bold, letterSpacing: 1 },
  title: { fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 4 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { flexDirection: 'row' },
  photoPanel: { position: 'absolute', backgroundColor: 'rgba(17,17,17,0.82)' },
});
