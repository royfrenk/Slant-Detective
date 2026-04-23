import { describe, it, expect } from 'vitest';
import { isNonEnglish } from '../index';

describe('isNonEnglish()', () => {
  it('detects Spanish body text as non-English', () => {
    const text =
      'El presidente anunció hoy que las medidas de seguridad serán reforzadas en todas ' +
      'las ciudades del país. El gobierno considera que es necesario actuar de forma ' +
      'inmediata ante la situación actual. Los expertos han señalado que la crisis ' +
      'requiere una respuesta coordinada entre los distintos ministerios y autoridades ' +
      'locales. La oposición ha criticado duramente las decisiones adoptadas hasta ahora ' +
      'y ha pedido una reunión urgente del parlamento para debatir las medidas propuestas.';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('detects French body text as non-English', () => {
    const text =
      "Le président a annoncé aujourd'hui que les mesures de sécurité seront renforcées " +
      'dans toutes les villes du pays. Le gouvernement estime qu\'il est nécessaire d\'agir ' +
      'immédiatement face à la situation actuelle. Les experts ont souligné que la crise ' +
      'nécessite une réponse coordonnée entre les différents ministères et autorités locales. ' +
      "L'opposition a vivement critiqué les décisions prises jusqu'à présent et a demandé " +
      'une réunion urgente du parlement pour débattre des mesures proposées par le gouvernement.';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('detects German body text as non-English', () => {
    const text =
      'Der Präsident gab heute bekannt, dass die Sicherheitsmaßnahmen in allen Städten des ' +
      'Landes verstärkt werden sollen. Die Regierung ist der Ansicht, dass angesichts der ' +
      'aktuellen Lage sofortiges Handeln notwendig ist. Experten haben darauf hingewiesen, ' +
      'dass die Krise eine koordinierte Reaktion zwischen den verschiedenen Ministerien und ' +
      'lokalen Behörden erfordert. Die Opposition hat die bisher getroffenen Entscheidungen ' +
      'scharf kritisiert und eine dringende Parlamentssitzung gefordert, um die Maßnahmen zu ' +
      'diskutieren.';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('returns false for English control text — news article', () => {
    const text =
      'The president announced today that security measures would be strengthened in all ' +
      'cities across the country. The government believes that immediate action is necessary ' +
      'given the current situation. Experts have noted that the crisis requires a coordinated ' +
      'response among the various ministries and local authorities. The opposition has ' +
      'sharply criticized the decisions taken so far and has called for an urgent parliamentary ' +
      'session to debate the proposed measures.';
    expect(isNonEnglish(text)).toBe(false);
  });

  it('returns false for English control text — financial news', () => {
    const text =
      'Breaking news: stocks fell sharply after the Federal Reserve signaled another interest ' +
      'rate hike this month. Markets reacted swiftly to the announcement, with the S&P 500 ' +
      'dropping more than two percent in early trading. Analysts warned that tighter monetary ' +
      'policy could slow economic growth and increase unemployment in the coming quarters. ' +
      'Bond yields surged as investors reassessed their outlook for the remainder of the year.';
    expect(isNonEnglish(text)).toBe(false);
  });

  it('returns false for English control text — science article', () => {
    const text =
      'Scientists at MIT have discovered a new method for generating clean energy using a ' +
      'novel photocatalytic process. The breakthrough, published in the journal Nature, could ' +
      'significantly reduce the cost of solar fuel production. Researchers demonstrated that ' +
      'the new catalyst achieves an efficiency rate nearly three times higher than existing ' +
      'approaches. The team believes the technology could be scaled up for industrial ' +
      'applications within the next decade, pending further development and testing.';
    expect(isNonEnglish(text)).toBe(false);
  });

  it('returns false for very short body text (below confidence threshold)', () => {
    const text = 'Hello world this is a short test';
    expect(isNonEnglish(text)).toBe(false);
  });

  it('returns false for predominantly English text with embedded Spanish quotes', () => {
    const text =
      'The president spoke at length about foreign policy, adding que todo está bien ' +
      'when asked about relations with neighboring countries. He continued in English for ' +
      'most of the press conference, covering economic policy, trade agreements, and the ' +
      'upcoming summit. Reporters noted that the brief Spanish aside drew attention but did ' +
      'not alter the overall tone of the carefully prepared statement released to the press.';
    expect(isNonEnglish(text)).toBe(false);
  });

  // SD-047 follow-up: franc-min has no script expression for Hebrew. Without
  // the Unicode script-ratio fast path, mixed Hebrew/English articles (names,
  // years, quoted phrases in Latin script) made Latin win franc's script vote
  // and the Latin-only trigrams picked 'eng' — the Haaretz regression from
  // 2026-04-23 passed the non-English gate and ran full Layer 2 analysis.
  it('detects Hebrew body text as non-English (regression: Haaretz)', () => {
    const text =
      'הנשיא הודיע היום כי צעדי הביטחון יוגברו בכל ערי המדינה. הממשלה סבורה כי יש לפעול ' +
      'באופן מיידי לנוכח המצב הנוכחי. מומחים ציינו כי המשבר מחייב תגובה מתואמת בין המשרדים ' +
      'השונים והרשויות המקומיות. האופוזיציה מתחה ביקורת חריפה על ההחלטות שהתקבלו עד כה ודרשה ' +
      'כינוס דחוף של הפרלמנט לדיון בצעדים המוצעים על ידי הממשלה.';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('detects Hebrew body text with embedded English names as non-English', () => {
    const text =
      'ראש הממשלה Netanyahu נפגש אתמול עם Donald Trump בוושינגטון. הפגישה נערכה בבית הלבן ' +
      'ועסקה בנושאים מדיניים וביטחוניים. בכירים בשתי הממשלות ציינו כי השיחה הייתה פורה. ' +
      'הנושאים שעלו כללו את איראן, חמאס, ואת ההסכמים עם מדינות המפרץ. שני המנהיגים הדגישו ' +
      'את החשיבות של שיתוף הפעולה האסטרטגי בין המדינות.';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('detects Chinese body text as non-English', () => {
    const text =
      '总统今天宣布将在全国各城市加强安全措施。政府认为面对当前形势必须立即采取行动。' +
      '专家指出,这场危机需要各部委和地方当局之间的协调反应。反对派强烈批评迄今为止所作的决定,' +
      '并要求紧急召开议会会议讨论政府提出的措施。经济学家表示当前的政策可能会影响市场稳定。';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('detects Japanese body text as non-English', () => {
    const text =
      '大統領は本日、全国の都市で治安対策を強化すると発表した。政府は現状を踏まえ、即座に行動する' +
      '必要があると考えている。専門家は、危機には各省庁と地方自治体の間の協調した対応が必要だと' +
      '指摘した。野党はこれまでに下された決定を厳しく批判し、提案された措置を議論するため、議会の' +
      '緊急会議を要求した。';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('detects Russian body text as non-English', () => {
    const text =
      'Президент сегодня объявил, что меры безопасности будут усилены во всех городах страны. ' +
      'Правительство считает, что необходимо действовать немедленно в связи с текущей ситуацией. ' +
      'Эксперты отметили, что кризис требует скоординированного реагирования между различными ' +
      'министерствами и местными властями. Оппозиция резко раскритиковала принятые до сих пор решения.';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('detects Arabic body text as non-English', () => {
    const text =
      'أعلن الرئيس اليوم أن التدابير الأمنية ستعزز في جميع مدن البلاد. تعتقد الحكومة أنه ' +
      'من الضروري التصرف على الفور في ضوء الوضع الحالي. أشار الخبراء إلى أن الأزمة تتطلب ' +
      'استجابة منسقة بين مختلف الوزارات والسلطات المحلية. انتقدت المعارضة بشدة القرارات ' +
      'المتخذة حتى الآن ودعت إلى عقد جلسة برلمانية عاجلة لمناقشة التدابير المقترحة.';
    expect(isNonEnglish(text)).toBe(true);
  });

  it('returns false for English text with a single quoted Hebrew name', () => {
    const text =
      'The Israeli prime minister, known to his supporters as "ביבי", met with American ' +
      'officials yesterday to discuss the ongoing negotiations. The meeting covered a range ' +
      'of topics including regional security, trade agreements, and humanitarian aid to the ' +
      'neighboring territories. Both delegations emphasized the importance of continued ' +
      'dialogue and cooperation in addressing the complex challenges facing the region. ' +
      'Analysts noted that the tone of the talks was markedly more constructive than in ' +
      'previous rounds, with officials from both sides expressing cautious optimism about ' +
      'reaching a framework agreement in the coming weeks.';
    expect(isNonEnglish(text)).toBe(false);
  });
});
