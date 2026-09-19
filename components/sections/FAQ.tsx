'use client';

import { useTranslations } from 'next-intl';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_NOTES: Record<number, 'todayUpload' | 'todayExport'> = {
  3: 'todayUpload',
  4: 'todayExport',
};

export function FAQ() {
  const t = useTranslations();
  const faqItems = t.raw('faq.items') as FAQItem[];

  return (
    <section className="lp-band lp-band-alt" id="faq">
      <div className="lp-wrap">
        <header className="lp-band-head">
          <span className="lp-eyebrow">{t('ui.faq')}</span>
          <h2>{t('faq.title')}</h2>
        </header>
        <div className="faq-list">
          {faqItems.map((faq, index) => (
            <details key={faq.question} className="faq" open={index === 0}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
              {FAQ_NOTES[index] && <p className="faq-note">{t(`ui.${FAQ_NOTES[index]}`)}</p>}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
