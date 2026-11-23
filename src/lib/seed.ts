import type { Equipment, Exercise, ExerciseType, Muscle } from './types';

// name | equipment | type | primary | secondary (comma separated)
const RAW = `
Bench Press|barbell|weight_reps|chest|shoulders,triceps
Incline Bench Press|barbell|weight_reps|chest|shoulders,triceps
Decline Bench Press|barbell|weight_reps|chest|triceps
Close Grip Bench Press|barbell|weight_reps|triceps|chest,shoulders
Floor Press|barbell|weight_reps|chest|triceps
Bench Press|dumbbell|weight_reps|chest|shoulders,triceps
Incline Bench Press|dumbbell|weight_reps|chest|shoulders,triceps
Chest Fly|dumbbell|weight_reps|chest|shoulders
Incline Chest Fly|dumbbell|weight_reps|chest|shoulders
Pullover|dumbbell|weight_reps|chest|lats,triceps
Chest Press|machine|weight_reps|chest|shoulders,triceps
Pec Deck|machine|weight_reps|chest|shoulders
Cable Fly Crossover|cable|weight_reps|chest|shoulders
Low Cable Fly|cable|weight_reps|chest|shoulders
Push Up|none|reps_only|chest|shoulders,triceps
Weighted Push Up|plate|weighted_bodyweight|chest|shoulders,triceps
Diamond Push Up|none|reps_only|triceps|chest,shoulders
Chest Dip|none|weighted_bodyweight|chest|triceps,shoulders
Assisted Dip|machine|assisted_bodyweight|chest|triceps,shoulders
Overhead Press|barbell|weight_reps|shoulders|triceps,upper_back
Push Press|barbell|weight_reps|shoulders|triceps,quadriceps
Seated Overhead Press|dumbbell|weight_reps|shoulders|triceps
Arnold Press|dumbbell|weight_reps|shoulders|triceps
Lateral Raise|dumbbell|weight_reps|shoulders|traps
Lateral Raise|cable|weight_reps|shoulders|traps
Lateral Raise|machine|weight_reps|shoulders|
Front Raise|dumbbell|weight_reps|shoulders|chest
Front Raise|plate|weight_reps|shoulders|chest
Rear Delt Fly|dumbbell|weight_reps|shoulders|upper_back
Reverse Pec Deck|machine|weight_reps|shoulders|upper_back
Face Pull|cable|weight_reps|shoulders|upper_back,traps
Shoulder Press|machine|weight_reps|shoulders|triceps
Upright Row|barbell|weight_reps|traps|shoulders,biceps
Landmine Press|barbell|weight_reps|shoulders|chest,triceps
Handstand Push Up|none|reps_only|shoulders|triceps
Pike Push Up|none|reps_only|shoulders|triceps,chest
Deadlift|barbell|weight_reps|lower_back|glutes,hamstrings,traps,forearms
Sumo Deadlift|barbell|weight_reps|glutes|quadriceps,hamstrings,lower_back,adductors
Romanian Deadlift|barbell|weight_reps|hamstrings|glutes,lower_back
Romanian Deadlift|dumbbell|weight_reps|hamstrings|glutes,lower_back
Stiff Leg Deadlift|barbell|weight_reps|hamstrings|glutes,lower_back
Trap Bar Deadlift|other|weight_reps|quadriceps|glutes,hamstrings,lower_back,traps
Rack Pull|barbell|weight_reps|lower_back|traps,glutes,forearms
Good Morning|barbell|weight_reps|hamstrings|lower_back,glutes
Back Extension|none|weighted_bodyweight|lower_back|glutes,hamstrings
Bent Over Row|barbell|weight_reps|upper_back|lats,biceps,lower_back
Pendlay Row|barbell|weight_reps|upper_back|lats,biceps
T Bar Row|barbell|weight_reps|upper_back|lats,biceps
One Arm Row|dumbbell|weight_reps|lats|upper_back,biceps
Chest Supported Row|dumbbell|weight_reps|upper_back|lats,biceps
Seated Cable Row|cable|weight_reps|upper_back|lats,biceps
Seated Row|machine|weight_reps|upper_back|lats,biceps
Lat Pulldown|cable|weight_reps|lats|biceps,upper_back
Close Grip Lat Pulldown|cable|weight_reps|lats|biceps
Straight Arm Pulldown|cable|weight_reps|lats|triceps
Lat Pulldown|machine|weight_reps|lats|biceps
Pull Up|none|weighted_bodyweight|lats|biceps,upper_back
Chin Up|none|weighted_bodyweight|lats|biceps
Assisted Pull Up|machine|assisted_bodyweight|lats|biceps
Inverted Row|none|reps_only|upper_back|lats,biceps
Ring Row|suspension|reps_only|upper_back|lats,biceps
Rope Climb|other|reps_only|lats|biceps,forearms
Shrug|barbell|weight_reps|traps|forearms
Shrug|dumbbell|weight_reps|traps|forearms
Squat|barbell|weight_reps|quadriceps|glutes,hamstrings,lower_back
Front Squat|barbell|weight_reps|quadriceps|glutes,abdominals
Box Squat|barbell|weight_reps|quadriceps|glutes,hamstrings
Pause Squat|barbell|weight_reps|quadriceps|glutes
Goblet Squat|kettlebell|weight_reps|quadriceps|glutes
Goblet Squat|dumbbell|weight_reps|quadriceps|glutes
Hack Squat|machine|weight_reps|quadriceps|glutes
Leg Press|machine|weight_reps|quadriceps|glutes,hamstrings
Bulgarian Split Squat|dumbbell|weight_reps|quadriceps|glutes,hamstrings
Bulgarian Split Squat|barbell|weight_reps|quadriceps|glutes,hamstrings
Lunge|dumbbell|weight_reps|quadriceps|glutes,hamstrings
Walking Lunge|dumbbell|weight_reps|quadriceps|glutes,hamstrings
Reverse Lunge|barbell|weight_reps|quadriceps|glutes
Step Up|dumbbell|weight_reps|quadriceps|glutes
Bodyweight Squat|none|reps_only|quadriceps|glutes
Jump Squat|none|reps_only|quadriceps|glutes,calves
Pistol Squat|none|reps_only|quadriceps|glutes
Leg Extension|machine|weight_reps|quadriceps|
Lying Leg Curl|machine|weight_reps|hamstrings|calves
Seated Leg Curl|machine|weight_reps|hamstrings|
Nordic Hamstring Curl|none|reps_only|hamstrings|
Hip Thrust|barbell|weight_reps|glutes|hamstrings
Hip Thrust|machine|weight_reps|glutes|hamstrings
Glute Bridge|none|reps_only|glutes|hamstrings
Cable Pull Through|cable|weight_reps|glutes|hamstrings
Cable Kickback|cable|weight_reps|glutes|
Hip Abduction|machine|weight_reps|abductors|glutes
Hip Adduction|machine|weight_reps|adductors|
Copenhagen Plank|none|duration|adductors|abdominals
Standing Calf Raise|machine|weight_reps|calves|
Seated Calf Raise|machine|weight_reps|calves|
Calf Raise|dumbbell|weight_reps|calves|
Calf Press on Leg Press|machine|weight_reps|calves|
Kettlebell Swing|kettlebell|weight_reps|glutes|hamstrings,lower_back,shoulders
Turkish Get Up|kettlebell|weight_reps|full_body|shoulders,abdominals,glutes
Kettlebell Clean|kettlebell|weight_reps|full_body|glutes,shoulders
Kettlebell Snatch|kettlebell|weight_reps|full_body|shoulders,glutes
Power Clean|barbell|weight_reps|full_body|quadriceps,glutes,traps,shoulders
Hang Clean|barbell|weight_reps|full_body|traps,glutes,shoulders
Clean and Jerk|barbell|weight_reps|full_body|quadriceps,shoulders,glutes
Snatch|barbell|weight_reps|full_body|shoulders,quadriceps,glutes
Thruster|barbell|weight_reps|full_body|quadriceps,shoulders
Burpee|none|reps_only|full_body|chest,quadriceps,cardio
Bicep Curl|barbell|weight_reps|biceps|forearms
EZ Bar Curl|barbell|weight_reps|biceps|forearms
Bicep Curl|dumbbell|weight_reps|biceps|forearms
Hammer Curl|dumbbell|weight_reps|biceps|forearms
Incline Curl|dumbbell|weight_reps|biceps|
Concentration Curl|dumbbell|weight_reps|biceps|
Preacher Curl|barbell|weight_reps|biceps|
Preacher Curl|machine|weight_reps|biceps|
Bicep Curl|cable|weight_reps|biceps|forearms
Spider Curl|dumbbell|weight_reps|biceps|
Reverse Curl|barbell|weight_reps|forearms|biceps
Wrist Curl|barbell|weight_reps|forearms|
Reverse Wrist Curl|dumbbell|weight_reps|forearms|
Farmers Walk|dumbbell|weight_distance|forearms|traps,full_body
Dead Hang|none|duration|forearms|lats
Plate Pinch|plate|weight_duration|forearms|
Gi Pull Up|other|weighted_bodyweight|forearms|lats,biceps
Towel Hang|other|duration|forearms|lats
Triceps Pushdown|cable|weight_reps|triceps|
Rope Pushdown|cable|weight_reps|triceps|
Overhead Triceps Extension|cable|weight_reps|triceps|
Overhead Triceps Extension|dumbbell|weight_reps|triceps|
Skull Crusher|barbell|weight_reps|triceps|
Triceps Kickback|dumbbell|weight_reps|triceps|
Bench Dip|none|reps_only|triceps|chest,shoulders
Triceps Dip|none|weighted_bodyweight|triceps|chest,shoulders
Triceps Extension|machine|weight_reps|triceps|
Plank|none|duration|abdominals|shoulders
Side Plank|none|duration|abdominals|
Crunch|none|reps_only|abdominals|
Cable Crunch|cable|weight_reps|abdominals|
Hanging Leg Raise|none|reps_only|abdominals|forearms
Hanging Knee Raise|none|reps_only|abdominals|
Lying Leg Raise|none|reps_only|abdominals|
Ab Wheel Rollout|other|reps_only|abdominals|lats,shoulders
Russian Twist|plate|weight_reps|abdominals|
Sit Up|none|reps_only|abdominals|
Decline Sit Up|none|weighted_bodyweight|abdominals|
Dead Bug|none|reps_only|abdominals|
Hollow Body Hold|none|duration|abdominals|
Pallof Press|cable|weight_reps|abdominals|
Woodchopper|cable|weight_reps|abdominals|shoulders
Dragon Flag|none|reps_only|abdominals|
L Sit|none|duration|abdominals|triceps
Neck Curl|plate|weight_reps|neck|
Neck Extension|plate|weight_reps|neck|traps
Neck Bridge|none|duration|neck|traps
Banded Neck Side Flexion|band|reps_only|neck|
Band Pull Apart|band|reps_only|upper_back|shoulders
Banded Face Pull|band|reps_only|shoulders|upper_back
Banded Row|band|reps_only|upper_back|lats,biceps
Banded Hip Thrust|band|reps_only|glutes|hamstrings
TRX Row|suspension|reps_only|upper_back|lats,biceps
TRX Push Up|suspension|reps_only|chest|triceps,shoulders
TRX Pistol Squat|suspension|reps_only|quadriceps|glutes
Sled Push|other|weight_distance|quadriceps|glutes,calves,cardio
Sled Pull|other|weight_distance|hamstrings|glutes,upper_back
Running|none|distance_duration|cardio|quadriceps,calves
Treadmill|machine|distance_duration|cardio|quadriceps
Cycling|machine|distance_duration|cardio|quadriceps
Rowing Machine|machine|distance_duration|cardio|upper_back,lats,quadriceps
Elliptical|machine|distance_duration|cardio|quadriceps
Stair Climber|machine|duration|cardio|glutes,quadriceps
Jump Rope|other|duration|cardio|calves
Assault Bike|machine|distance_duration|cardio|full_body
Swimming|none|distance_duration|cardio|full_body
Battle Ropes|other|duration|cardio|shoulders
Box Jump|none|reps_only|quadriceps|glutes,calves
Broad Jump|none|reps_only|quadriceps|glutes
Medicine Ball Slam|other|weight_reps|full_body|abdominals,shoulders
Wall Ball|other|weight_reps|full_body|quadriceps,shoulders
Bear Crawl|none|duration|full_body|shoulders,abdominals
Sprawl|none|reps_only|full_body|cardio
Hip Escape (Shrimp)|none|reps_only|abdominals|glutes
Bridge and Roll (Upa)|none|reps_only|glutes|abdominals,neck
`;

const HOWTO: Record<string, string[]> = {
  'Bench Press (Barbell)': [
    'שכב על הספסל, עיניים מתחת למוט, כפות רגליים על הרצפה.',
    'אחוז במוט מעט יותר רחב מהכתפיים, הוצא אותו מהמתקן עם ידיים ישרות.',
    'הורד לאט עד שהמוט נוגע בחזה, מרפקים בזווית של כ־45 מעלות מהגוף.',
    'דחוף חזרה למעלה עד שהידיים ישרות.',
  ],
  'Squat (Barbell)': [
    'הנח את המוט על הגב העליון, רגליים ברוחב כתפיים.',
    'נשום עמוק, הדק את הבטן.',
    'רד בכיפוף ירכיים וברכיים עד שהירך מתחת לקו הברך או כמה שאפשר בגב ישר.',
    'עלה דרך כל כף הרגל עד עמידה מלאה.',
  ],
  'Deadlift (Barbell)': [
    'עמוד עם אמצע כף הרגל מתחת למוט.',
    'התכופף ואחוז במוט מחוץ לברכיים, גב ישר, כתפיים מעל המוט.',
    'דחוף את הרצפה ברגליים והרם את המוט צמוד לגוף עד עמידה מלאה.',
    'הורד באותו מסלול, ירכיים אחורה קודם.',
  ],
  'Overhead Press (Barbell)': [
    'אחוז במוט ברוחב כתפיים, מונח על הכתפיים הקדמיות.',
    'הדק ישבן ובטן.',
    'דחוף את המוט ישר למעלה, הראש זז מעט אחורה ואז קדימה מתחת למוט.',
    'הורד בשליטה חזרה לכתפיים.',
  ],
  'Pull Up': [
    'היתלה על המתח באחיזה מעט רחבה מהכתפיים, כפות ידיים קדימה.',
    'משוך את השכמות למטה והתחל למשוך.',
    'עלה עד שהסנטר מעל המוט.',
    'רד בשליטה עד ידיים ישרות.',
  ],
  'Bent Over Row (Barbell)': [
    'אחוז במוט, התכופף מהירכיים עד שהגב כמעט מקביל לרצפה.',
    'משוך את המוט לבטן התחתונה, מרפקים צמודים.',
    'הורד בשליטה עד ידיים ישרות.',
  ],
  'Hip Thrust (Barbell)': [
    'שב עם הגב העליון על ספסל, מוט מרופד על הירכיים.',
    'דחוף דרך העקבים והרם את האגן עד קו ישר מהכתפיים לברכיים.',
    'החזק שנייה למעלה ורד בשליטה.',
  ],
  'Romanian Deadlift (Barbell)': [
    'עמוד עם המוט בידיים, ברכיים כפופות מעט.',
    'דחוף את הירכיים אחורה והורד את המוט צמוד לרגליים עד מתיחה בהמסטרינג.',
    'חזור למעלה בדחיפת הירכיים קדימה, גב ישר כל הזמן.',
  ],
  'Plank': [
    'שען על האמות ועל קצות האצבעות.',
    'גוף בקו ישר מהראש לעקבים, בטן וישבן מכווצים.',
    'החזק את הזמן בלי לתת לאגן לרדת.',
  ],
  'Kettlebell Swing (Kettlebell)': [
    'עמוד מעט רחב מהכתפיים, קטלבל לפניך.',
    'הנף את הקטלבל אחורה בין הרגליים בכיפוף ירכיים.',
    'דחוף את הירכיים קדימה בחדות כך שהקטלבל עולה לגובה החזה.',
    'תן לו ליפול חזרה והמשך בתנועה רציפה.',
  ],
};

export function displayName(name: string, equipment: Equipment): string {
  const tag: Record<Equipment, string> = {
    none: '', barbell: 'Barbell', dumbbell: 'Dumbbell', kettlebell: 'Kettlebell', machine: 'Machine',
    cable: 'Cable', plate: 'Plate', band: 'Band', suspension: 'Suspension', other: '',
  };
  return tag[equipment] && !name.includes(tag[equipment]) ? `${name} (${tag[equipment]})` : name;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function seedExercises(): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();
  for (const line of RAW.trim().split('\n')) {
    const [base, eq, type, primary, sec] = line.split('|');
    const name = displayName(base, eq as Equipment);
    const id = 'x-' + slug(name);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      equipment: eq as Equipment,
      type: type as ExerciseType,
      primary: primary as Muscle,
      secondary: sec ? (sec.split(',') as Muscle[]) : [],
      howto: HOWTO[name],
    });
  }
  return out;
}
