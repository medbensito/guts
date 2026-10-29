  // ---------- Renard : aplats, contour nuit, d'après les planches de référence ----------
  // Le stade règle le nombre de queues et les proportions (tête, yeux, oreilles).
  // L'humeur règle le visage, et la pose : assis, ou couché et enroulé pour « endormie ».
  const R = {
    fourrure: '#2a62e0', ombre: '#2543c9', creme: '#fff4ea', nuit: '#0a0f26',
    cyan: '#7ef0ff', iris: '#4f7cff', rouge: '#ff4d5e', rose: '#ff8c97'
  };
  const FORME = {
    renardeau:  { queues: 1, queue: 0.78, tete: 1.14, oeil: 1.12, oreille: 0.92 },
    jeune:      { queues: 2, queue: 0.86, tete: 1.06, oeil: 1.05, oreille: 0.98 },
    adolescent: { queues: 3, queue: 0.94, tete: 1.0,  oeil: 1.0,  oreille: 1.04 },
    adulte:     { queues: 3, queue: 1.06, tete: 0.94, oeil: 0.94, oreille: 1.1 }
  };
  // Formes de base (repère 200 × 200, sol à y = 192, cou en 100,126)
  const F = {
    queue: 'M -13 2 C -32 -18 -38 -54 -22 -80 C -15 -92 -6 -100 4 -106 C 1 -94 7 -84 15 -74 C 28 -56 27 -24 13 2 Z',
    boutQueue: 'M -44 -64 L -30 -60 L -22 -70 L -12 -62 L -2 -73 L 7 -64 L 17 -74 L 44 -66 L 44 -130 L -44 -130 Z',
    crane: 'M 54 88 C 54 64 68 49 86 46 L 91 36 L 98 44 L 105 33 L 111 46 C 132 50 146 66 146 88 L 158 95 L 147 100 L 155 110 L 139 111 C 129 123 115 128 100 128 C 85 128 71 123 61 111 L 45 110 L 53 100 L 42 95 Z',
    masque: 'M 30 150 L 30 104 Q 60 96 79 106 Q 91 113 100 104 Q 109 113 121 106 Q 140 96 170 104 L 170 150 Z',
    marque: 'M 100.5 48 C 93 53 91 60 94.5 65.5 C 96.5 68.5 99.5 71 101 76 C 103 71 108.5 67.5 108.5 62 C 108.5 57 102.5 55.5 100.5 59.5 C 99.5 61.5 101 63.5 103.5 63 C 102 66.5 97.5 65 96.8 61 C 96 56.5 98 52 100.5 48 Z',
    oreilles: [
      { d: 'M 62 80 C 54 58 50 34 52 9 C 71 18 87 36 95 58 Z', dedans: 'M 68 70 C 64 56 62 44 62 32 C 72 39 80 49 86 60 Z', bout: 'M 30 40 L 92 22 L 92 -10 L 30 -10 Z', x: 70 },
      { d: 'M 138 80 C 146 58 150 34 148 9 C 129 18 113 36 105 58 Z', dedans: 'M 132 70 C 136 56 138 44 138 32 C 128 39 120 49 114 60 Z', bout: 'M 170 40 L 108 22 L 108 -10 L 170 -10 Z', x: 130 }
    ],
    torse: 'M 74 190 C 68 160 76 130 100 126 C 124 130 132 160 126 190 Z',
    pattes: ['M 82.5 148 L 82.5 186 Q 82.5 192 90.5 192 Q 98.5 192 98.5 186 L 98.5 148 Z',
             'M 101.5 148 L 101.5 186 Q 101.5 192 109.5 192 Q 117.5 192 117.5 186 L 117.5 148 Z'],
    chaussettes: 'M 70 200 L 70 176 L 82 176 L 86 170 L 90 176 L 94 171 L 98 177 L 102 177 L 106 171 L 110 176 L 114 170 L 118 176 L 130 176 L 130 200 Z',
    plastron: 'M 69 128 Q 100 116 131 128 L 132 141 L 125 149 L 121 144 L 115 157 L 108 151 L 100 167 L 92 151 L 85 157 L 79 144 L 75 149 L 68 141 Z',
    couche: 'M 40 191 C 32 162 60 138 100 137 C 142 136 168 162 162 191 Z',
    enroulee: 'M 42 176 C 44 196 118 200 158 191 C 170 188 178 179 183 166 C 174 173 162 176 150 175 C 116 173 80 178 58 168 C 52 166 46 170 42 176 Z',
    boutEnroulee: 'M 150 158 L 157 167 L 150 174 L 158 181 L 151 189 L 158 198 L 200 200 L 200 150 Z'
  };
  let numRenard = 0;

  const trait = w => `stroke="${R.nuit}" stroke-width="${w.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"`;
  const lueur = (d, w) => `<path class="lueur" d="${d}" fill="none" stroke="${R.cyan}" stroke-width="${w.toFixed(2)}" stroke-linecap="round"/>`;
  // Forme pleine + détails découpés à l'intérieur + contour par-dessus
  const piece = (id, d, details, w) => `
    <path id="${id}" d="${d}" fill="${R.fourrure}"/>
    <clipPath id="${id}c"><use href="#${id}"/></clipPath>
    <g clip-path="url(#${id}c)">${details}</g>
    <path d="${d}" fill="none" ${trait(w)}/>`;

  // Queue, pointe en haut, base en (0,0) puis tournée en place. Forme commune définie dans <defs>.
  function queue(u, x, y, angle, taille, sw) {
    return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${taille})">
      <use href="#${u}q" fill="${R.fourrure}"/>
      <g clip-path="url(#${u}qc)">
        <path d="${F.boutQueue}" fill="${R.creme}"/>
        <path d="M -44 8 L 44 8 L 44 -6 Q 0 0 -44 -10 Z" fill="${R.ombre}"/>
      </g>
      ${lueur('M -16 -22 C -6 -30 -5 -40 -14 -50', 4 / taille)}
      <use href="#${u}q" fill="none" ${trait(sw / taille)}/>
    </g>`;
  }

  // Œil ouvert : contour nuit, iris bleu, croissant cyan, pupille, reflets, cils côté extérieur.
  const oeil = (cx, cy, cote, k) => `<g transform="translate(${cx} ${cy}) scale(${k})">
      <ellipse rx="11.5" ry="13" fill="${R.nuit}"/>
      <ellipse cy="1" rx="8.6" ry="10.2" fill="${R.iris}"/>
      <ellipse cy="6.5" rx="5.6" ry="3.2" fill="${R.cyan}"/>
      <ellipse cy="-0.5" rx="4.6" ry="6.2" fill="${R.nuit}"/>
      <circle cx="${3.4 * cote}" cy="-5" r="3.3" fill="#fff"/>
      <circle cx="${-3.4 * cote}" cy="5" r="1.5" fill="#fff"/>
      <path d="M ${-10 * cote} -6 L ${-16 * cote} -10 M ${-11 * cote} -1 L ${-16.5 * cote} -2" fill="none" stroke="${R.nuit}" stroke-width="3" stroke-linecap="round"/>
    </g>`;

  function visage(humeur, f, sw) {
    const ouverts = `<g class="yeux">${oeil(80, 94, 1, f.oeil)}${oeil(120, 94, -1, f.oeil)}</g>`;
    const nez = `<path d="M 95 108 Q 100 106 105 108 Q 103 113 100 114 Q 97 113 95 108 Z" fill="${R.nuit}"/>`;
    const bouche = `<path d="M 92 118 Q 96 122 100 118 Q 104 122 108 118" fill="none" ${trait(sw * 0.75)}/>`;
    if (humeur === 'joyeuse') return `
      <path d="M 69 97 Q 80 84 91 97 M 109 97 Q 120 84 131 97" fill="none" ${trait(sw * 1.15)}/>
      <ellipse cx="68" cy="107" rx="6.5" ry="3.4" fill="${R.rose}"/><ellipse cx="132" cy="107" rx="6.5" ry="3.4" fill="${R.rose}"/>
      ${nez}
      <path d="M 90 117 Q 100 133 110 117 Q 100 120 90 117 Z" fill="${R.nuit}" ${trait(sw * 0.6)}/>
      <path d="M 94.5 123.5 Q 100 120.5 105.5 123.5 Q 100 129.5 94.5 123.5 Z" fill="${R.rouge}"/>`;
    if (humeur === 'endormie') return `
      <path d="M 69 95 Q 80 104 91 95 M 109 95 Q 120 104 131 95" fill="none" ${trait(sw * 1.15)}/>
      ${nez}${bouche}`;
    if (humeur === 'determinee') return `
      ${ouverts}
      <path d="M 62 72 L 98 72 L 98 93 L 66 84 Z M 138 72 L 102 72 L 102 93 L 134 84 Z" fill="${R.fourrure}"/>
      <path d="M 66 84 L 95 92 M 134 84 L 105 92" fill="none" ${trait(sw * 1.1)}/>
      ${nez}${bouche}`;
    if (humeur === 'fatiguee') return `
      ${ouverts}
      <path d="M 64 79 L 97 79 L 97 95 Q 80.5 100 64 95 Z M 103 79 L 136 79 L 136 95 Q 119.5 100 103 95 Z" fill="${R.fourrure}"/>
      <path d="M 67 95 Q 80.5 100 94 95 M 106 95 Q 119.5 100 133 95" fill="none" ${trait(sw * 1.05)}/>
      ${nez}
      <path d="M 92 120 Q 96 117 100 120 Q 104 123 108 120" fill="none" ${trait(sw * 0.75)}/>
      <path d="M 146 62 Q 153 74 146 79 Q 139 74 146 62 Z" fill="${R.cyan}" ${trait(sw * 0.6)}/>`;
    // curieuse
    return `${ouverts}${nez}<ellipse cx="100" cy="120" rx="3" ry="3.4" fill="${R.nuit}"/>`;
  }

  // Tête : oreilles, crâne, masque crème, marques, visage. Attachée au cou (100, 126).
  function tete(u, humeur, f, sw) {
    const oreilles = F.oreilles.map((o, i) => `
      <g transform="translate(${o.x} 70) scale(1 ${f.oreille}) translate(${-o.x} -70)">
        ${piece(u + 'o' + i, o.d, `<path d="${o.bout}" fill="${R.nuit}"/><path d="${o.dedans}" fill="${R.creme}"/>`, sw)}
      </g>`).join('');
    return `${oreilles}
      ${piece(u + 't', F.crane, `<path d="${F.masque}" fill="${R.creme}"/>`, sw)}
      <ellipse cx="78" cy="73" rx="5.5" ry="2.6" transform="rotate(-18 78 73)" fill="${R.creme}"/>
      <ellipse cx="122" cy="73" rx="5.5" ry="2.6" transform="rotate(18 122 73)" fill="${R.creme}"/>
      <path class="lueur" d="${F.marque}" fill="${R.cyan}"/>
      ${visage(humeur, f, sw)}`;
  }

  function renard(stade = 'renardeau', humeur = 'curieuse') {
    const st = CONFIG.stades.find(s => s.id === stade) || CONFIG.stades[0];
    const f = FORME[st.id] || FORME.adolescent;
    const u = 'gr' + (++numRenard) + '-';       // identifiants uniques dans la page
    const sw = 4 / st.echelle;                   // contour constant quel que soit le stade
    const texte = (x, y, taille, t) => `<text x="${x}" y="${y}" font-size="${taille}" font-weight="900" fill="${R.cyan}" stroke="${R.nuit}" stroke-width="3.5" paint-order="stroke">${t}</text>`;
    let corps;

    if (humeur === 'endormie') {
      // Couché, enroulé dans une queue ; les autres queues dépassent derrière le dos.
      const arriere = { 1: [], 2: [-38], 3: [-58, -28] }[f.queues] || [];
      const k = f.tete * 0.78;
      corps = `
        ${arriere.map(a => queue(u, 60, 176, a, f.queue, sw)).join('')}
        <path d="${F.couche}" fill="${R.fourrure}" ${trait(sw)}/>
        <ellipse cx="72" cy="168" rx="28" ry="21" fill="${R.fourrure}" ${trait(sw)}/>
        ${lueur('M 56 168 C 60 158 70 154 80 156', 4)}
        ${piece(u + 'e', F.enroulee, `<path d="${F.boutEnroulee}" fill="${R.creme}"/>`, sw)}
        ${lueur('M 92 187 C 102 183 112 184 120 189', 4)}
        <g transform="translate(128 182) rotate(4) scale(${k}) translate(-100 -126)">${tete(u, 'endormie', f, sw / k)}</g>
        ${texte(160, 78, 20, 'z')}${texte(174, 60, 15, 'z')}`;
    } else {
      const angles = { 1: [-50], 2: [-62, -30], 3: [-70, -45, -20] }[f.queues] || [-50];
      const decal = { 1: 4, 2: 7, 3: 10 }[f.queues] || 6;   // recentre : les queues partent à gauche
      const pencher = humeur === 'curieuse' ? -8 : 0;
      const pattes = F.pattes.map((d, i) => piece(u + 'p' + i, d,
        `<path d="${F.chaussettes}" fill="${R.creme}"/><rect x="70" y="185" width="60" height="20" fill="${R.nuit}"/>`, sw)).join('');
      corps = `<g transform="translate(${decal} 0)">
        ${angles.map(a => queue(u, 82, 178, a, f.queue, sw)).join('')}
        <ellipse cx="72" cy="172" rx="24" ry="19" fill="${R.fourrure}" ${trait(sw)}/>
        <ellipse cx="128" cy="172" rx="24" ry="19" fill="${R.fourrure}" ${trait(sw)}/>
        ${lueur('M 54 170 C 58 162 66 159 72 160', 4)}
        <path d="${F.torse}" fill="${R.fourrure}" ${trait(sw)}/>
        ${pattes}
        <path d="${F.plastron}" fill="${R.creme}" ${trait(sw)}/>
        <g transform="translate(100 126) rotate(${pencher}) scale(${f.tete}) translate(-100 -126)">${tete(u, humeur, f, sw / f.tete)}</g>
        ${humeur === 'curieuse' ? texte(150, 40, 28, '?') : ''}
      </g>`;
    }

    return `<svg class="fox ${humeur}" viewBox="0 0 200 200" role="img" aria-label="Guts, ${st.nom}">
      <defs><path id="${u}q" d="${F.queue}"/><clipPath id="${u}qc"><use href="#${u}q"/></clipPath></defs>
      <g class="fox-reaction"><g transform="translate(100 192) scale(${st.echelle}) translate(-100 -192)">${corps}</g></g>
    </svg>`;
  }
