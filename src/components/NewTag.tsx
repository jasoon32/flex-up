import { Platform, StyleSheet, Text, type TextStyle } from 'react-native';
import { useI18n } from '@/i18n';
import { fonts } from '@/theme';

const RAINBOW = ['#E53935', '#FB8C00', '#F4C20D', '#43A047', '#1E88E5', '#8E24AA'];

/** Rainbow "NEW" after an exercise name the user has never logged. Goes inside the name's <Text>. */
export function NewTag() {
  const { t } = useI18n();
  const { newExercise: text, newExerciseLabel: label } = t.workout;
  if (Platform.OS === 'web') {
    return (
      <Text accessibilityLabel={label} style={[s.tag, web]}>
        {` ${text}`}
      </Text>
    );
  }
  // Native text can't be filled with a gradient, so each letter gets its own colour.
  return (
    <Text accessibilityLabel={label} style={s.tag}>
      {' '}
      {[...text].map((ch, i) => (
        <Text key={i} style={{ color: RAINBOW[Math.round((i * (RAINBOW.length - 1)) / Math.max(1, text.length - 1))] }}>
          {ch}
        </Text>
      ))}
    </Text>
  );
}

const web = {
  backgroundImage: `linear-gradient(90deg, ${RAINBOW.join(', ')})`,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
} as unknown as TextStyle;

const s = StyleSheet.create({
  tag: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
});
