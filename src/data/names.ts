import { currentLang, type Lang } from '@/i18n';
import type { WeightUnit } from '@/lib/types';

/**
 * Built-in exercise and plan names, English → 简体中文. Names are always saved in English;
 * a saved name that is one of these shows in Chinese when the app is in Chinese. Anything
 * the user typed themselves stays exactly as typed in both languages.
 */
export const EXERCISE_NAMES: Record<string, string> = {
  // Chest
  'Bench Press': '卧推',
  'Barbell Bench Press': '杠铃卧推',
  'Incline Barbell Bench Press': '上斜杠铃卧推',
  'Decline Barbell Bench Press': '下斜杠铃卧推',
  'Close-Grip Bench Press': '窄握卧推',
  'Dumbbell Bench Press': '哑铃卧推',
  'Incline DB Bench Press': '上斜哑铃卧推',
  'Decline Dumbbell Bench Press': '下斜哑铃卧推',
  'Dumbbell Fly': '哑铃飞鸟',
  'Incline Dumbbell Fly': '上斜哑铃飞鸟',
  'Smith Machine Flat Bench Press': '史密斯平板卧推',
  'Smith Machine Incline Bench Press': '史密斯上斜卧推',
  'Machine Chest Press': '器械推胸',
  'Incline Machine Chest Press': '上斜器械推胸',
  'Pec Deck': '蝴蝶机夹胸',
  'Cable Fly': '绳索夹胸',
  'High-to-Low Cable Fly': '高位绳索夹胸',
  'Low-to-High Cable Fly': '低位绳索夹胸',
  'Cable Crossover': '绳索交叉夹胸',
  'Push-Up': '俯卧撑',
  'Incline Push-Up': '上斜俯卧撑',
  'Decline Push-Up': '下斜俯卧撑',
  'Diamond Push-Up': '钻石俯卧撑',
  'Chest Dip': '胸部双杠臂屈伸',
  'Dumbbell Pullover': '哑铃仰卧上拉',
  'Floor Press': '地板卧推',
  // Back
  'Pull-Up': '引体向上',
  'Neutral-Grip Pull-Ups': '对握引体向上',
  'Chin-Up': '反握引体向上',
  'Assisted Pull-Up': '辅助引体向上',
  'Lat Pulldown': '高位下拉',
  'Machine Lat Pulldown': '器械高位下拉',
  'Close-Grip Lat Pulldown': '窄握高位下拉',
  'Wide-Grip Lat Pulldown': '宽握高位下拉',
  'Plate-Loaded Lat Pulldown': '挂片式高位下拉',
  'Back Pulldown + Row': '下拉加划船',
  'Straight-Arm Pulldown': '直臂下压',
  'Barbell Row': '杠铃划船',
  'Pendlay Row': '彭德雷划船',
  'T-Bar Row': 'T杠划船',
  'Dumbbell Row': '哑铃划船',
  'One-Arm Dumbbell Row': '单臂哑铃划船',
  'Seated DB Row': '坐姿哑铃划船',
  'Chest-Supported Dumbbell Row': '俯卧支撑哑铃划船',
  'Seated Cable Row': '坐姿绳索划船',
  'Machine Row': '器械划船',
  'Narrow-Grip Row': '窄握划船',
  'Wide-Grip Row': '宽握划船',
  'Inverted Row': '反向划船',
  'Meadows Row': '梅多斯划船',
  Deadlift: '硬拉',
  'Sumo Deadlift': '相扑硬拉',
  'Rack Pull': '架上硬拉',
  'Back Extension': '山羊挺身',
  'Good Morning': '早安式体前屈',
  'Barbell Shrug': '杠铃耸肩',
  'Dumbbell Shrug': '哑铃耸肩',
  // Shoulders
  'Overhead Press': '站姿推举',
  'Seated Barbell Overhead Press': '坐姿杠铃推举',
  'Dumbbell Shoulder Press': '哑铃肩推',
  'Arnold Press': '阿诺德推举',
  'Shoulder Press': '肩推',
  'Machine Shoulder Press': '器械肩推',
  'Smith Machine Shoulder Press': '史密斯肩推',
  'Push Press': '借力推举',
  'Lateral Raise': '侧平举',
  'Cable Lateral Raise': '绳索侧平举',
  'Machine Lateral Raise': '器械侧平举',
  'Front Raise': '前平举',
  'Cable Front Raise': '绳索前平举',
  'Rear Delt Machine': '器械反向飞鸟',
  'Reverse Pec Deck': '反向蝴蝶机',
  'Rear Delt Dumbbell Fly': '哑铃俯身飞鸟',
  'Face Pull': '面拉',
  'Upright Row': '直立划船',
  'Landmine Press': '地雷管推举',
  // Biceps
  'Bicep Curl': '二头弯举',
  'Barbell Curl': '杠铃弯举',
  'EZ-Bar Curl': '曲杆弯举',
  'DB Bicep Curl': '哑铃二头弯举',
  'Dumbbell Curl': '哑铃弯举',
  'Hammer Curl': '锤式弯举',
  'Incline Dumbbell Curl': '上斜哑铃弯举',
  'Concentration Curl': '集中弯举',
  'Preacher Curl': '牧师凳弯举',
  'EZ-Bar Preacher Curl': '曲杆牧师凳弯举',
  'Machine Preacher Curl': '器械牧师凳弯举',
  'Cable Curl': '绳索弯举',
  'Bayesian Cable Curl': '贝叶斯绳索弯举',
  'Spider Curl': '蜘蛛弯举',
  'Reverse Curl': '反握弯举',
  'Zottman Curl': '佐特曼弯举',
  // Triceps
  'Triceps Pushdown': '三头下压',
  'Rope Pushdown': '绳索三头下压',
  'Straight-Bar Pushdown': '直杆三头下压',
  'Cable Overhead Triceps Extension': '绳索过头臂屈伸',
  'Dumbbell Overhead Triceps Extension': '哑铃过头臂屈伸',
  'Skull Crusher': '仰卧臂屈伸',
  'EZ-Bar Skull Crusher': '曲杆仰卧臂屈伸',
  'Dumbbell Kickback': '哑铃俯身臂屈伸',
  'Cable Kickback': '绳索俯身臂屈伸',
  'Triceps Dip': '双杠臂屈伸',
  'Bench Dip': '凳上臂屈伸',
  'Machine Triceps Extension': '器械三头伸展',
  'JM Press': 'JM推',
  // Legs
  Squat: '深蹲',
  'Back Squat': '杠铃深蹲',
  'Front Squat': '前蹲',
  'Smith Machine Squat': '史密斯深蹲',
  'Goblet Squat': '高脚杯深蹲',
  'Dumbbell Squat': '哑铃深蹲',
  'Hack Squat': '哈克深蹲',
  'Pendulum Squat': '钟摆深蹲',
  'Belt Squat': '腰带深蹲',
  'Box Squat': '箱式深蹲',
  'Leg Press': '腿举',
  'Single-Leg Leg Press': '单腿腿举',
  'Bulgarian Split Squat': '保加利亚分腿蹲',
  'Split Squat': '分腿蹲',
  Lunge: '箭步蹲',
  'Walking Lunge': '行走箭步蹲',
  'Reverse Lunge': '后撤箭步蹲',
  'Dumbbell Lunge': '哑铃箭步蹲',
  'Barbell Lunge': '杠铃箭步蹲',
  'Step-Up': '登阶',
  'Romanian Deadlift': '罗马尼亚硬拉',
  'Dumbbell Romanian Deadlift': '哑铃罗马尼亚硬拉',
  'Stiff-Leg Deadlift': '直腿硬拉',
  'Single-Leg Romanian Deadlift': '单腿罗马尼亚硬拉',
  'Hip Thrust': '臀推',
  'Barbell Hip Thrust': '杠铃臀推',
  'Glute Bridge': '臀桥',
  'Cable Pull-Through': '绳索后拉',
  'Leg Extension': '腿屈伸',
  'Leg Curl': '腿弯举',
  'Lying Leg Curl': '俯卧腿弯举',
  'Seated Leg Curl': '坐姿腿弯举',
  'Nordic Hamstring Curl': '北欧腘绳肌弯举',
  'Hip Adductor': '髋内收',
  'Hip Abductor': '髋外展',
  'Cable Glute Kickback': '绳索后踢腿',
  'Calf Raise': '提踵',
  'Standing Calf Raise': '站姿提踵',
  'Seated Calf Raise': '坐姿提踵',
  'Leg Press Calf Raise': '腿举机提踵',
  'Smith Machine Calf Raise': '史密斯提踵',
  'Tibialis Raise': '胫骨前肌抬起',
  // Core
  'Abs Crunch Machine': '器械卷腹',
  "Captain's Chair": '船长椅举腿',
  Crunch: '卷腹',
  'Cable Crunch': '绳索卷腹',
  'Hanging Leg Raise': '悬垂举腿',
  'Hanging Knee Raise': '悬垂提膝',
  'Lying Leg Raise': '仰卧举腿',
  Plank: '平板支撑',
  'Side Plank': '侧平板支撑',
  'Ab Wheel Rollout': '健腹轮',
  'Russian Twist': '俄罗斯转体',
  'Sit-Up': '仰卧起坐',
  'Decline Sit-Up': '下斜仰卧起坐',
  'Bicycle Crunch': '自行车卷腹',
  'Mountain Climber': '登山跑',
  'Pallof Press': '帕洛夫推',
  Woodchopper: '伐木式',
  'Dead Bug': '死虫式',
  // Full body / Olympic / kettlebell
  'Power Clean': '高翻',
  'Hang Clean': '悬垂翻',
  'Clean and Jerk': '挺举',
  Snatch: '抓举',
  Thruster: '火箭推',
  'Kettlebell Swing': '壶铃摆荡',
  'Kettlebell Goblet Squat': '壶铃高脚杯深蹲',
  'Kettlebell Clean': '壶铃翻',
  'Turkish Get-Up': '土耳其起立',
  "Farmer's Walk": '农夫行走',
  'Sled Push': '推雪橇',
  Burpee: '波比跳',
  'Box Jump': '跳箱',
  'Battle Ropes': '战绳',
  // Forearms
  'Wrist Curl': '腕弯举',
  'Reverse Wrist Curl': '反握腕弯举',
  'Dead Hang': '悬垂',
  // Cardio
  'Treadmill Run': '跑步机跑步',
  'Outdoor Run': '户外跑',
  'Incline Walk': '坡度快走',
  'Stationary Bike': '动感单车',
  'Rowing Machine': '划船机',
  Elliptical: '椭圆机',
  'Stair Climber': '爬楼机',
  'Jump Rope': '跳绳',
};

/** Common workout names and splits (PPL, Upper/Lower, body-part days), English → 简体中文. */
export const PLAN_NAMES: Record<string, string> = {
  Push: '推',
  Pull: '拉',
  Legs: '腿',
  Upper: '上肢',
  Lower: '下肢',
  'Full Body': '全身',
  Chest: '胸',
  Back: '背',
  Shoulders: '肩',
  Arms: '手臂',
  Abs: '腹肌',
  Core: '核心',
  Glutes: '臀',
  Cardio: '有氧',
  Run: '跑步',
  HIIT: 'HIIT',
  Mobility: '灵活性',
  Recovery: '恢复',
  'Chest & Triceps': '胸和三头',
  'Back & Biceps': '背和二头',
  'Shoulders & Arms': '肩和手臂',
  'Chest & Back': '胸和背',
  'Legs & Abs': '腿和腹肌',
  'Push A': '推 A',
  'Push B': '推 B',
  'Pull A': '拉 A',
  'Pull B': '拉 B',
  'Legs A': '腿 A',
  'Legs B': '腿 B',
  'Upper A': '上肢 A',
  'Upper B': '上肢 B',
  'Lower A': '下肢 A',
  'Lower B': '下肢 B',
};

/** Built-in exercises done with bodyweight: they start as BW, so a blank weight can be ticked. */
const BODYWEIGHT = new Set([
  'Push-Up',
  'Incline Push-Up',
  'Decline Push-Up',
  'Diamond Push-Up',
  'Chest Dip',
  'Pull-Up',
  'Neutral-Grip Pull-Ups',
  'Chin-Up',
  'Inverted Row',
  'Back Extension',
  'Triceps Dip',
  'Bench Dip',
  'Nordic Hamstring Curl',
  "Captain's Chair",
  'Crunch',
  'Hanging Leg Raise',
  'Hanging Knee Raise',
  'Lying Leg Raise',
  'Plank',
  'Side Plank',
  'Ab Wheel Rollout',
  'Sit-Up',
  'Decline Sit-Up',
  'Bicycle Crunch',
  'Mountain Climber',
  'Dead Bug',
  'Burpee',
  'Box Jump',
  'Dead Hang',
]);

/** Built-in exercises logged as the weight of one dumbbell (or one side): volume counts both. */
const PER_SIDE = new Set([
  'Dumbbell Bench Press',
  'Incline DB Bench Press',
  'Decline Dumbbell Bench Press',
  'Dumbbell Fly',
  'Incline Dumbbell Fly',
  'Dumbbell Row',
  'One-Arm Dumbbell Row',
  'Seated DB Row',
  'Chest-Supported Dumbbell Row',
  'Dumbbell Shrug',
  'Dumbbell Shoulder Press',
  'Arnold Press',
  'Lateral Raise',
  'Front Raise',
  'Rear Delt Dumbbell Fly',
  'DB Bicep Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Incline Dumbbell Curl',
  'Concentration Curl',
  'Zottman Curl',
  'Dumbbell Kickback',
  'Dumbbell Squat',
  'Dumbbell Lunge',
  'Dumbbell Romanian Deadlift',
  "Farmer's Walk",
]);

/**
 * Unit and per-hand settings for an exercise picked by name: BW for bodyweight moves, Per hand
 * for dumbbell lifts. A different built-in name undoes BW from a previous pick; the user's own
 * names leave the settings as they are.
 */
export function exerciseDefaults(
  name: string,
  current: { weight_unit: WeightUnit; per_side: boolean },
): Partial<{ weight_unit: WeightUnit; per_side: boolean }> {
  if (!(name in EXERCISE_NAMES)) return {};
  if (BODYWEIGHT.has(name)) return { weight_unit: 'bw', per_side: false };
  return { weight_unit: current.weight_unit === 'bw' ? 'kg' : current.weight_unit, per_side: PER_SIDE.has(name) };
}

export type NameKind = 'exercise' | 'plan';
const LISTS: Record<NameKind, Record<string, string>> = { exercise: EXERCISE_NAMES, plan: PLAN_NAMES };

/** A saved name as shown in `lang`: built-in names are translated, the user's own stay as typed. */
export function nameIn(name: string, lang: Lang, kind: NameKind = 'exercise'): string {
  return lang === 'zh' ? (LISTS[kind][name] ?? name) : name;
}

/** `nameIn` for the current language. Screens using `useI18n` re-render when it changes. */
export const trName = (name: string, kind: NameKind = 'exercise') => nameIn(name, currentLang(), kind);

/**
 * What to save for text shown or typed in a name field: a built-in Chinese name maps back to its
 * English key, and a built-in English name typed in any case ("squat") becomes that built-in
 * ("Squat"), so it translates and gets its defaults.
 */
export function toSaved(text: string, kind: NameKind = 'exercise'): string {
  const t = text.trim();
  for (const [en, zh] of Object.entries(LISTS[kind])) if (zh === t) return en;
  // Exact text only: "squat " (still typing) stays as it is.
  const lower = text.toLowerCase();
  for (const en of Object.keys(LISTS[kind])) if (en.toLowerCase() === lower) return en;
  return text;
}
