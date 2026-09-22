import { useMemo, useState } from 'react';

const DIGITAL_HELP = [
  {
    title: 'AA online meetings',
    tag: 'Alcohol support',
    body: 'Search video, phone, chat, and email Alcoholics Anonymous meetings across time zones.',
    url: 'https://aa-intergroup.org/meetings/',
    cta: 'Find online AA meetings',
  },
  {
    title: 'NA virtual meetings',
    tag: 'Substance support',
    body: 'Browse online Narcotics Anonymous meetings by language, day, time, and format.',
    url: 'https://virtual-na.org/meetings/',
    cta: 'Find online NA meetings',
  },
  {
    title: 'SMART Recovery online',
    tag: 'Skills-based groups',
    body: 'Live mutual-support meetings, tools, and message boards for addiction recovery.',
    url: 'https://meetings.smartrecovery.org/meetings/?meetingType=1',
    cta: 'Search SMART online',
  },
  {
    title: 'SAMHSA helpline',
    tag: '24/7 national line',
    body: 'Free, confidential treatment referral and information service in English and Spanish.',
    url: 'https://www.samhsa.gov/find-help/national-helpline',
    cta: 'Open helpline info',
  },
];

const CITY_HELP = [
  {
    title: 'AA meetings by city or area',
    body: 'Use the official AA Meeting Guide and local AA directories to find in-person or hybrid groups wherever you are.',
    url: 'https://www.aa.org/find-aa',
  },
  {
    title: 'Treatment and counseling locator',
    body: 'FindTreatment.gov searches licensed treatment providers, outpatient care, and recovery support by location.',
    url: 'https://findtreatment.gov/',
  },
  {
    title: '988 crisis support',
    body: 'If this is urgent or you might hurt yourself, call or text 988 in the U.S. for immediate crisis support.',
    url: 'https://988lifeline.org/',
  },
];

function normalizeZip(value) {
  return value.replace(/[^0-9]/g, '').slice(0, 5);
}

export default function GetHelp() {
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState('10');
  const cleanZip = normalizeZip(zip);
  const canSearch = cleanZip.length === 5;

  const physicalLinks = useMemo(() => {
    if (!canSearch) return [];
    const encodedZip = encodeURIComponent(cleanZip);
    const encodedRadius = encodeURIComponent(radius);
    const aaQuery = encodeURIComponent(`AA meetings near ${cleanZip} within ${radius} miles`);
    const supportQuery = encodeURIComponent(`addiction recovery support groups near ${cleanZip} within ${radius} miles`);

    return [
      {
        title: 'AA meetings near this ZIP',
        body: `Search Google Maps for Alcoholics Anonymous groups within about ${radius} miles of ${cleanZip}.`,
        url: `https://www.google.com/maps/search/${aaQuery}`,
      },
      {
        title: 'Official AA area finder',
        body: 'Open AA.org to find the nearest local AA office, meeting guide, and city-level listings.',
        url: `https://www.aa.org/find-aa?search=${encodedZip}`,
      },
      {
        title: 'FindTreatment.gov near this ZIP',
        body: `Search federal treatment-provider listings around ${cleanZip}. Adjust filters for outpatient, telehealth, payment, and distance.`,
        url: `https://findtreatment.gov/results?zip=${encodedZip}&radius=${encodedRadius}`,
      },
      {
        title: 'Recovery support groups nearby',
        body: 'Search nearby peer-support options beyond AA, including SMART Recovery, NA, and local community groups.',
        url: `https://www.google.com/maps/search/${supportQuery}`,
      },
    ];
  }, [canSearch, cleanZip, radius]);

  return (
    <main className="main get-help-page">
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Get Help</span>
      </div>

      <section className="get-help-hero panel">
        <div className="help-kicker">Support when willpower is not enough</div>
        <h1>Get help online or near you.</h1>
        <p>
          Find digital recovery meetings, AA groups, crisis lines, and physical support by ZIP code.
          This app is a tracker — these links connect you with people and services built for real support.
        </p>
        <div className="help-urgent-card">
          <strong>If you are in immediate danger:</strong> call emergency services now. In the U.S., call or text <a href="tel:988">988</a> for the Suicide & Crisis Lifeline.
        </div>
      </section>

      <section className="panel">
        <div className="panel-head help-panel-head">
          <div>
            <span className="panel-title">Physical help near you</span>
            <p className="panel-sub">Enter a ZIP code and choose how wide to search.</p>
          </div>
        </div>

        <form className="help-search" onSubmit={event => event.preventDefault()}>
          <label className="help-field">
            <span>ZIP code</span>
            <input
              value={zip}
              onChange={event => setZip(normalizeZip(event.target.value))}
              inputMode="numeric"
              maxLength={5}
              placeholder="92101"
              aria-label="ZIP code"
            />
          </label>
          <label className="help-field help-radius-field">
            <span>Radius</span>
            <select value={radius} onChange={event => setRadius(event.target.value)} aria-label="Search radius">
              <option value="5">5 miles</option>
              <option value="10">10 miles</option>
              <option value="25">25 miles</option>
              <option value="50">50 miles</option>
              <option value="100">100 miles</option>
            </select>
          </label>
        </form>

        {!canSearch ? (
          <div className="help-empty-state">
            Enter a 5-digit ZIP code to create local AA, treatment, and peer-support searches.
          </div>
        ) : (
          <div className="help-results-grid">
            {physicalLinks.map(link => (
              <a key={link.title} className="help-result-card" href={link.url} target="_blank" rel="noreferrer">
                <span className="help-result-eyebrow">{radius} mi from {cleanZip}</span>
                <strong>{link.title}</strong>
                <p>{link.body}</p>
                <span className="help-result-cta">Open search →</span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head help-panel-head">
          <div>
            <span className="panel-title">Digital and online help</span>
            <p className="panel-sub">Online meetings, hotlines, and recovery communities you can open from anywhere.</p>
          </div>
        </div>
        <div className="digital-help-grid">
          {DIGITAL_HELP.map(item => (
            <a key={item.title} className="digital-help-card" href={item.url} target="_blank" rel="noreferrer">
              <span className="help-pill">{item.tag}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <span>{item.cta} →</span>
            </a>
          ))}
        </div>
      </section>

      <section className="panel city-help-panel">
        <div className="panel-head help-panel-head">
          <div>
            <span className="panel-title">Any city or online</span>
            <p className="panel-sub">When you are traveling or helping someone elsewhere, start here.</p>
          </div>
        </div>
        <div className="city-help-list">
          {CITY_HELP.map(item => (
            <a key={item.title} className="city-help-row" href={item.url} target="_blank" rel="noreferrer">
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
              <span>Open →</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
