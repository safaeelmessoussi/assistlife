/**
 * Names and short explanations for the Islamic layer, each with its evidence
 * and source.
 *
 * REVIEW STATUS: every entry is pending review by a qualified scholar before
 * public release (docs/PLAN.md, "Content rules"). Texts are limited to
 * well-established narrations; the source is shown to the user with the text.
 */
import type { Lang } from '@/i18n/strings';
import type { ContentKey } from '@/lib/islamic';

type Localized = Record<Lang, string>;

export type IslamicContent = {
  title: Localized;
  note: Localized;
  /** Arabic text of the verse or hadith, and where it is found. */
  evidence?: { text: string; source: string };
};

export const ISLAMIC_CONTENT: Record<ContentKey, IslamicContent> = {
  ramadan: {
    title: { ar: 'صيام رمضان', fr: 'Jeûne du Ramadan', en: 'Ramadan fast' },
    note: {
      ar: 'نصوم إيمانًا واحتسابًا، طاعةً لله وطلبًا لمغفرته.',
      fr: 'Nous jeûnons avec foi, par obéissance à Allah et en espérant Son pardon.',
      en: 'We fast out of faith, in obedience to Allah and hoping for His forgiveness.',
    },
    evidence: { text: 'من صام رمضان إيمانًا واحتسابًا غُفر له ما تقدّم من ذنبه', source: 'البخاري 38، مسلم 760' },
  },
  arafah: {
    title: { ar: 'صيام يوم عرفة', fr: 'Jeûne du jour d’Arafat', en: 'Fast of the day of Arafah' },
    note: {
      ar: 'لغير الحاج. يوم دعاء وذكر وقرب من الله.',
      fr: 'Pour celui qui n’est pas en pèlerinage. Un jour d’invocation et de proximité avec Allah.',
      en: 'For those not on Hajj. A day of supplication and nearness to Allah.',
    },
    evidence: { text: 'صيام يوم عرفة أحتسب على الله أن يكفّر السنة التي قبله والسنة التي بعده', source: 'مسلم 1162' },
  },
  ashura: {
    title: { ar: 'صيام عاشوراء', fr: 'Jeûne d’Achoura', en: 'Fast of Ashura' },
    note: {
      ar: 'العاشر من محرم، ويُستحب صيام يوم قبله.',
      fr: 'Le 10 de Mouharram ; il est recommandé de jeûner aussi la veille.',
      en: 'The 10th of Muharram; fasting the day before it is recommended too.',
    },
    evidence: { text: 'وصيام يوم عاشوراء أحتسب على الله أن يكفّر السنة التي قبله', source: 'مسلم 1162' },
  },
  tasua: {
    title: { ar: 'صيام تاسوعاء', fr: 'Jeûne du 9 Mouharram', en: 'Fast of the 9th of Muharram' },
    note: {
      ar: 'اليوم الذي قبل عاشوراء.',
      fr: 'La veille d’Achoura.',
      en: 'The day before Ashura.',
    },
    evidence: { text: 'لئن بقيتُ إلى قابل لأصومنّ التاسع', source: 'مسلم 1134' },
  },
  dhulHijjah: {
    title: { ar: 'عشر ذي الحجة', fr: 'Dix premiers jours de Dhou al-Hijja', en: 'First ten days of Dhul Hijjah' },
    note: {
      ar: 'أيام يُحب فيها العمل الصالح: صيام وذكر وصدقة.',
      fr: 'Des jours où les bonnes œuvres sont les plus aimées : jeûne, rappel, aumône.',
      en: 'Days in which good deeds are most beloved: fasting, remembrance, charity.',
    },
    evidence: { text: 'ما من أيامٍ العملُ الصالح فيهنّ أحبّ إلى الله من هذه الأيام العشر', source: 'الترمذي 757، وأصله في البخاري 969' },
  },
  shawwal: {
    title: { ar: 'ستّ من شوال', fr: 'Six jours de Chawwal', en: 'Six days of Shawwal' },
    note: {
      ar: 'ستة أيام من شوال في أي وقت منه، متتابعة أو متفرقة.',
      fr: 'Six jours de Chawwal, à n’importe quel moment du mois, consécutifs ou non.',
      en: 'Any six days of Shawwal, together or apart.',
    },
    evidence: { text: 'من صام رمضان ثم أتبعه ستًّا من شوال كان كصيام الدهر', source: 'مسلم 1164' },
  },
  whiteDays: {
    title: { ar: 'صيام الأيام البيض', fr: 'Jeûne des jours blancs', en: 'Fast of the white days' },
    note: {
      ar: 'الثالث عشر والرابع عشر والخامس عشر من كل شهر هجري.',
      fr: 'Les 13, 14 et 15 de chaque mois hégirien.',
      en: 'The 13th, 14th and 15th of every Hijri month.',
    },
    evidence: { text: 'صوم ثلاثة أيام من كل شهر صوم الدهر كلّه', source: 'البخاري 1979، مسلم 1159' },
  },
  monThu: {
    title: { ar: 'صيام الاثنين والخميس', fr: 'Jeûne du lundi et du jeudi', en: 'Monday and Thursday fast' },
    note: {
      ar: 'سُنّة يسيرة تتكرر كل أسبوع.',
      fr: 'Une sunna simple qui revient chaque semaine.',
      en: 'A light sunnah that returns every week.',
    },
    evidence: { text: 'تُعرض الأعمال يوم الاثنين والخميس، فأحبّ أن يُعرض عملي وأنا صائم', source: 'الترمذي 747' },
  },
  newYear: {
    title: { ar: 'رأس السنة الهجرية', fr: 'Nouvel an hégirien', en: 'Hijri new year' },
    note: {
      ar: 'بداية عام جديد: وقفة محاسبة ونيّة صالحة لما هو آت، إن شاء الله.',
      fr: 'Début d’une nouvelle année : un moment de bilan et de bonne intention, in cha Allah.',
      en: 'The start of a new year: a moment to take stock and set a good intention, in sha Allah.',
    },
  },
  ramadanStart: {
    title: { ar: 'أول رمضان', fr: 'Début du Ramadan', en: 'First day of Ramadan' },
    note: {
      ar: 'يثبت دخول الشهر بإعلان بلدك؛ عدّل التاريخ من الإعدادات إن اختلف.',
      fr: 'Le début du mois est fixé par l’annonce de votre pays ; ajustez la date dans les réglages si elle diffère.',
      en: 'The month begins with your country’s announcement; adjust the date in settings if it differs.',
    },
    evidence: { text: 'شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ هُدًى لِلنَّاسِ', source: 'البقرة 185' },
  },
  lastTen: {
    title: { ar: 'العشر الأواخر من رمضان', fr: 'Dix dernières nuits du Ramadan', en: 'Last ten nights of Ramadan' },
    note: {
      ar: 'ليالٍ تُلتمس فيها ليلة القدر، في الأوتار خاصة.',
      fr: 'Des nuits où l’on recherche la Nuit du Destin, surtout les nuits impaires.',
      en: 'Nights in which Laylat al-Qadr is sought, especially the odd ones.',
    },
    evidence: { text: 'كان رسول الله ﷺ يجتهد في العشر الأواخر ما لا يجتهد في غيره', source: 'مسلم 1175' },
  },
  eidFitr: {
    title: { ar: 'عيد الفطر', fr: 'Aïd al-Fitr', en: 'Eid al-Fitr' },
    note: {
      ar: 'يوم فرح وشكر لله على تمام الصيام. لا يُصام هذا اليوم.',
      fr: 'Jour de joie et de gratitude envers Allah après le jeûne. On ne jeûne pas ce jour.',
      en: 'A day of joy and thanks to Allah for completing the fast. This day is not fasted.',
    },
    evidence: { text: 'نهى النبي ﷺ عن صوم يوم الفطر والنحر', source: 'البخاري 1991' },
  },
  eidAdha: {
    title: { ar: 'عيد الأضحى', fr: 'Aïd al-Adha', en: 'Eid al-Adha' },
    note: {
      ar: 'يوم النحر. لا يُصام هذا اليوم ولا الأيام الثلاثة بعده.',
      fr: 'Jour du sacrifice. On ne jeûne ni ce jour ni les trois jours suivants.',
      en: 'The day of sacrifice. Neither this day nor the three after it are fasted.',
    },
    evidence: { text: 'نهى النبي ﷺ عن صوم يوم الفطر والنحر', source: 'البخاري 1991' },
  },
  tashriq: {
    title: { ar: 'أيام التشريق', fr: 'Jours de Tachriq', en: 'Days of Tashriq' },
    note: {
      ar: 'الأيام الثلاثة بعد عيد الأضحى. لا تُصام.',
      fr: 'Les trois jours après l’Aïd al-Adha. On ne les jeûne pas.',
      en: 'The three days after Eid al-Adha. They are not fasted.',
    },
    evidence: { text: 'أيام التشريق أيام أكل وشرب وذكر لله', source: 'مسلم 1141' },
  },
  morning: {
    title: { ar: 'أذكار الصباح', fr: 'Invocations du matin', en: 'Morning remembrance' },
    note: {
      ar: 'نبدأ يومنا بذكر الله، فهو معنا حيثما كنا.',
      fr: 'Nous commençons la journée par le rappel d’Allah : Il est avec nous où que nous soyons.',
      en: 'We begin the day remembering Allah: He is with us wherever we are.',
    },
    evidence: { text: 'وَسَبِّحْ بِحَمْدِ رَبِّكَ قَبْلَ طُلُوعِ الشَّمْسِ وَقَبْلَ الْغُرُوبِ', source: 'ق 39' },
  },
  evening: {
    title: { ar: 'أذكار المساء', fr: 'Invocations du soir', en: 'Evening remembrance' },
    note: {
      ar: 'نختم نهارنا بذكر الله وشكره على ما يسّر.',
      fr: 'Nous terminons la journée par le rappel d’Allah et la gratitude pour ce qu’Il a facilité.',
      en: 'We close the day remembering Allah and thanking Him for what He made easy.',
    },
    evidence: { text: 'وَسَبِّحْ بِحَمْدِ رَبِّكَ قَبْلَ طُلُوعِ الشَّمْسِ وَقَبْلَ الْغُرُوبِ', source: 'ق 39' },
  },
  sleep: {
    title: { ar: 'أذكار النوم', fr: 'Invocations du coucher', en: 'Remembrance before sleep' },
    note: {
      ar: 'ننام بنيّة التقوّي على طاعة الله.',
      fr: 'Nous dormons avec l’intention de reprendre des forces pour obéir à Allah.',
      en: 'We sleep intending to gain strength for obeying Allah.',
    },
    evidence: { text: 'باسمك اللهم أموت وأحيا', source: 'البخاري 6312' },
  },
  kahf: {
    title: { ar: 'قراءة سورة الكهف', fr: 'Lecture de sourate Al-Kahf', en: 'Reading Surat al-Kahf' },
    note: {
      ar: 'تُقرأ يوم الجمعة، من غروب الخميس إلى غروب الجمعة.',
      fr: 'Elle se lit le vendredi, du coucher du soleil du jeudi à celui du vendredi.',
      en: 'It is read on Friday, from Thursday’s sunset to Friday’s sunset.',
    },
    evidence: { text: 'من قرأ سورة الكهف في يوم الجمعة أضاء له من النور ما بين الجمعتين', source: 'الحاكم والبيهقي' },
  },
  fridayHour: {
    title: { ar: 'ساعة الاستجابة', fr: 'L’heure de l’exaucement', en: 'The hour of response' },
    note: {
      ar: 'آخر ساعة بعد عصر الجمعة: وقت دعاء.',
      fr: 'La dernière heure après le Asr du vendredi : un moment d’invocation.',
      en: 'The last hour after Asr on Friday: a time for supplication.',
    },
    evidence: { text: 'فيه ساعة لا يوافقها عبد مسلم وهو قائم يصلي يسأل الله شيئًا إلا أعطاه إياه', source: 'البخاري 935، مسلم 852' },
  },
};
