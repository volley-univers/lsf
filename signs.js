// signs.js
// Définit les configurations de main (chiffres + lettres de l'alphabet manuel LSF)
// que l'application sait reconnaître, ainsi que les leçons qui les regroupent.
//
// Chaque signe est décrit par un "pattern" : quels doigts sont tendus (true)
// ou repliés (false), dans l'ordre [pouce, index, majeur, annulaire, auriculaire].
// Certains signes ajoutent une contrainte d'écartement ("spread") pour
// distinguer deux formes qui ont les mêmes doigts tendus (ex : U et V).
//
// NB : ces formes sont une approximation pédagogique du système de comptage
// et de l'alphabet manuel utilisés en France (le comptage commence au pouce,
// contrairement à la convention anglophone). Vérifie toujours auprès d'une
// ressource LSF certifiée pour un usage sérieux.

const SIGNS = {
  n1: { id:'n1', glyph:'1', category:'Chiffre', label:'Un',
    pattern:[true,false,false,false,false],
    hint:"Seul le pouce est levé, les quatre autres doigts sont repliés.", },
  n2: { id:'n2', glyph:'2', category:'Chiffre', label:'Deux',
    pattern:[true,true,false,false,false],
    hint:"Le pouce et l'index sont levés, collés l'un à l'autre.", },
  n3: { id:'n3', glyph:'3', category:'Chiffre', label:'Trois',
    pattern:[true,true,true,false,false],
    hint:"Pouce, index et majeur sont levés.", },
  n4: { id:'n4', glyph:'4', category:'Chiffre', label:'Quatre',
    pattern:[false,true,true,true,true],
    hint:"Les quatre doigts sont levés, le pouce reste replié dans la paume.",
    note:"Astuce : c'est la même forme que la lettre B !", },
  n5: { id:'n5', glyph:'5', category:'Chiffre', label:'Cinq',
    pattern:[true,true,true,true,true],
    hint:"La main est grande ouverte, les cinq doigts écartés.", },

  L: { id:'L', glyph:'L', category:'Lettre', label:'L',
    pattern:[true,true,false,false,false], spread:'wide',
    hint:"Pouce et index forment un angle droit, comme un « L ».",
    note:"Écarte bien le pouce de l'index pour la distinguer du chiffre 2.", },
  Y: { id:'Y', glyph:'Y', category:'Lettre', label:'Y',
    pattern:[true,false,false,false,true],
    hint:"Le pouce et l'auriculaire sont tendus, les trois doigts du milieu repliés.", },
  I: { id:'I', glyph:'I', category:'Lettre', label:'I',
    pattern:[false,false,false,false,true],
    hint:"Seul l'auriculaire est levé.", },
  F: { id:'F', glyph:'F', category:'Lettre', label:'F',
    pattern:[false,false,true,true,true],
    hint:"Pouce et index se touchent en cercle, les trois autres doigts sont tendus.", },
  B: { id:'B', glyph:'B', category:'Lettre', label:'B',
    pattern:[false,true,true,true,true],
    hint:"Les quatre doigts sont levés et serrés, le pouce replié devant la paume.",
    note:"C'est la même forme que le chiffre 4 !", },
  U: { id:'U', glyph:'U', category:'Lettre', label:'U',
    pattern:[false,true,true,false,false], spread:'narrow',
    hint:"Index et majeur levés, serrés l'un contre l'autre.", },
  V: { id:'V', glyph:'V', category:'Lettre', label:'V',
    pattern:[false,true,true,false,false], spread:'wide',
    hint:"Index et majeur levés, bien écartés en « V ».", },
  W: { id:'W', glyph:'W', category:'Lettre', label:'W',
    pattern:[false,true,true,true,false],
    hint:"Index, majeur et annulaire levés, pouce et auriculaire repliés.", },
};

// Leçons : regroupements pédagogiques, dans l'ordre de progression.
const LESSONS = [
  { id:'nombres-1', unit:'Chiffres', title:'1 à 3', signs:['n1','n2','n3'] },
  { id:'nombres-2', unit:'Chiffres', title:'4 et 5', signs:['n4','n5'] },
  { id:'alphabet-1', unit:'Alphabet', title:'I, Y, L', signs:['I','Y','L'] },
  { id:'alphabet-2', unit:'Alphabet', title:'U et V', signs:['U','V'] },
  { id:'alphabet-3', unit:'Alphabet', title:'B, F, W', signs:['B','F','W'] },
  { id:'revision', unit:'Révision', title:'Tout mélangé', signs:['n1','n2','n3','n4','n5','I','Y','L','U','V','B','F','W'] },
];

// ---- Logique de correspondance ----

// Indices des landmarks MediaPipe Hands utiles par doigt : [MCP, PIP, TIP]
const FINGER_LANDMARKS = {
  index:  [5, 6, 8],
  middle: [9, 10, 12],
  ring:   [13, 14, 16],
  pinky:  [17, 18, 20],
};

function dist(a, b){
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Extrait un vecteur de caractéristiques à partir des 21 landmarks d'une main.
function extractFeatures(landmarks){
  const wrist = landmarks[0];
  const handSize = dist(wrist, landmarks[9]) || 0.0001; // wrist -> middle MCP, sert de référence d'échelle

  const extended = [false, false, false, false, false]; // pouce, index, majeur, annulaire, auriculaire

  // Pouce : "sorti" si son extrémité est loin de la base de l'index, relativement à la taille de la main.
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  extended[0] = dist(thumbTip, indexMcp) > handSize * 0.55;

  // Doigts longs : "tendus" si l'extrémité est plus loin du poignet que l'articulation PIP et le MCP.
  const order = ['index','middle','ring','pinky'];
  order.forEach((name, i) => {
    const [mcpIdx, pipIdx, tipIdx] = FINGER_LANDMARKS[name];
    const mcp = landmarks[mcpIdx], pip = landmarks[pipIdx], tip = landmarks[tipIdx];
    const tipFromWrist = dist(wrist, tip);
    extended[i + 1] = tipFromWrist > dist(wrist, pip) * 1.05 && tipFromWrist > dist(wrist, mcp) * 1.1;
  });

  const spreadValue = dist(landmarks[8], landmarks[12]) / handSize; // index tip <-> middle tip

  return { extended, spreadValue };
}

// Compare les caractéristiques observées à un signe cible.
// Renvoie un score entre 0 et 1 et un booléen isMatch.
function matchSign(features, sign){
  let hits = 0;
  for(let i = 0; i < 5; i++){
    if(features.extended[i] === sign.pattern[i]) hits++;
  }
  let score = hits / 5;

  let spreadOk = true;
  if(sign.spread === 'wide') spreadOk = features.spreadValue > 0.5;
  if(sign.spread === 'narrow') spreadOk = features.spreadValue <= 0.5;
  if(!spreadOk) score -= 0.2;

  const isMatch = hits === 5 && spreadOk;
  return { score: Math.max(0, Math.min(1, score)), isMatch };
}

// Rendu utile côté navigateur (pas de bundler) : on expose tout sur window.
window.SIGNS = SIGNS;
window.LESSONS = LESSONS;
window.extractFeatures = extractFeatures;
window.matchSign = matchSign;
