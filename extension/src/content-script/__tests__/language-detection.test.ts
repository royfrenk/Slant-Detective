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
});
