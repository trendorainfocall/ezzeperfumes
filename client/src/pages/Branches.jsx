import React, { useEffect, useState } from 'react';
import { api, mapLink } from '../api.js';

export const osmEmbed = (b) => {
  const d = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${b.lng - d},${b.lat - d},${b.lng + d},${b.lat + d}&layer=mapnik&marker=${b.lat},${b.lng}`;
};

export default function Branches() {
  const [list, setList] = useState(null);
  useEffect(() => { api('/branches').then(setList).catch(() => setList([])); }, []);
  if (!list) return <p className="muted">Yüklənir...</p>;
  return (
    <div>
      <h2>Filiallarımız</h2>
      {!list.length && <p className="muted">Filial məlumatı tezliklə əlavə olunacaq.</p>}
      <div className="branch-grid">
        {list.map((b) => {
          const link = mapLink(b);
          const hasCoord = b.lat != null && b.lng != null;
          return (
            <div className="card branch" key={b._id}>
              {b.image ? <img src={b.image} alt={b.name} loading="lazy" /> : <div className="news-ph">EZZE</div>}
              <h3>{b.name}</h3>
              {b.hours && <div className="binfo"><small className="muted">🕒 İş saatları</small><span>{b.hours}</span></div>}
              {b.address && <div className="binfo"><small className="muted">📍 Ünvan</small><span>{b.address}</span></div>}
              {b.phone && <div className="binfo"><small className="muted">📞 Telefon</small><a href={'tel:' + b.phone}>{b.phone}</a></div>}
              {hasCoord && <iframe title={b.name} className="map" loading="lazy" src={osmEmbed(b)} />}
              {link && <a className="ghost btn" href={link} target="_blank" rel="noreferrer">🗺 Xəritədə aç</a>}
            </div>);
        })}
      </div>
    </div>
  );
}
