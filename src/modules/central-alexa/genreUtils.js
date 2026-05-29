// src/modules/central-alexa/genreUtils.js
// ─────────────────────────────────────────────────────────────
// Coloque todas as imagens em  src/assets/  antes de importar.
// ─────────────────────────────────────────────────────────────
import UnikoWaveImg  from '../../assets/UnikoWave.png';
import UnikoKpopImg  from '../../assets/UnikoKPOP.png';
import UnikoMPBImg   from '../../assets/UnikoMPB.png';
import UnikoRockImg  from '../../assets/UnikoRock.png';
import UnikoRapImg   from '../../assets/UnikoRap.png';
import UnikoPopImg    from '../../assets/UnikoPop.png';
import UnikoCowboyImg from '../../assets/UnikoCowboy.png';

// ─── Dados dos mascotes ──────────────────────────────────────
export const MASCOTS = {
  wave: {
    img:   UnikoWaveImg,
    name:  'UnikoWave',
    title: 'DJ da 7 Benefícios',
    lines: [
      'Bora colocar aquela música massa! 🎵',
      'Qualquer pedido, tô na área! 🎧',
      'Som no sistema, pode pedir! ⚡',
      'DJ da 7 Benefícios presenteando! 🎶',
    ],
  },

  pop: {
    img:   UnikoPopImg,
    name:  'UnikoPop',
    title: 'DJ do Drop',
    lines: [
      'VIBE ELETRÔNICA ATIVADA! ⚡',
      'Drop incoming... 3, 2, 1... 💥',
      'Esse beat não tem cura! 🔊',
      'EDM mode: full send! 🎛️',
    ],
  },

  kpop: {
    img:   UnikoKpopImg,
    name:  'UnikoKpop',
    title: 'Stan Supremo',
    lines: [
      '안녕하세요! Modo K-pop ativado! 🐰',
      'Qual é o seu bias? 💜',
      'Visual + vocal + dancer — 완벽해! ✨',
      'Oppa aprova esse som! 🌸',
    ],
  },

  rap: {
    img:   UnikoRapImg,
    name:  'UnikoRap',
    title: 'True Damage DJ',
    lines: [
      'Real recognize real 💜',
      'Flow pesado no sistema! 🔥',
      'Trap mode: ON 🎤',
      'Bar atrás de bar, sem parar! 🎶',
    ],
  },

  cowboy: {
    img:   UnikoCowboyImg,
    name:  'UnikoCowboy',
    title: 'DJ da Sofrência',
    lines: [
      'Moda de viola direto no coração! 🤠',
      'No forró a gente esquece o resto! 🌾',
      'Sertanejo raiz, sofrência na veia! 🍺',
      'Tchê, esse som tá bom demais! 🎻',
    ],
  },

  rock: {
    img:   UnikoRockImg,
    name:  'UnikoRock',
    title: 'DJ Rita Lee',
    lines: [
      'ROCK AND ROLL NEVER DIES! 🤘',
      'Esse riff é cirúrgico! 🎸',
      'Samba e axé também têm alma de rock! 🔥',
      'Rita Lee aprovaria esse som! ⭐',
    ],
  },

  mpb: {
    img:   UnikoMPBImg,
    name:  'UnikoMPB',
    title: 'DJ da Alma Brasileira',
    lines: [
      'Que delícia de música brasileira ✨',
      'MPB na veia, alma no compasso 🌸',
      'Gal, Marina, Djavan... pura arte 🎶',
      'Saudade que alimenta a alma 🍃',
    ],
  },
};

// ─── Artistas mapeados por gênero ───────────────────────────
const GENRE_ARTISTS = {
  kpop: [
    'bts', 'blackpink', 'twice', 'exo', 'stray kids', 'nct', 'aespa', 'ive',
    'newjeans', 'new jeans', 'seventeen', 'got7', 'monsta x', 'shinee', 'red velvet', 'itzy',
    'le sserafim', 'bigbang', 'super junior', 'gidle', '2ne1', 'f(x)', 'day6',
    'txt', 'enhypen', 'mamamoo', 'gfriend', 'loona', 'astro', 'pentagon',
    // 4ª geração / em alta
    'katseye', 'illit', 'riize', 'zerobaseone', 'zb1', 'babymonster',
    'kiss of life', 'meovv', 'unis', 'qwer', 'young posse',
    'boynextdoor', '&team', 'dkb', 'ateez', 'p1harmony', 'cravity',
    'xdinary heroes', 'n.flying', 'onewe', 'verivery',
    // j-pop
    'yoasobi', 'ado', 'kenshi yonezu', 'babymetal', 'one ok rock', 'scandal',
    'perfume', 'utada hikaru', 'radwimps', 'eve', 'yorushika',
    'fujii kaze', 'king gnu', 'official hige dandism', 'back number',
  ],
  rap: [
    'eminem', 'drake', 'kendrick lamar', 'travis scott', 'kanye west', 'jay-z',
    'cardi b', 'nicki minaj', 'lil wayne', 'future', 'young thug', 'migos',
    'j. cole', 'j cole', 'a$ap rocky', 'asap rocky', 'lil uzi vert',
    'playboi carti', 'juice wrld', 'xxxtentacion', 'pop smoke', 'roddy ricch',
    'tyler the creator', 'childish gambino', 'frank ocean', 'ice spice',
    'gunna', 'lil baby', 'dababy', 'city girls', 'doja cat', 'doechii',
    // brasileiros
    'djonga', 'bk', 'matuê', 'veigh', 'oruam', 'krawk', 'orochi',
    'mc cabelinho', 'borges', 'filipe ret', 'teto', 'anitta', 'ludmilla',
    'mc carol', 'mc lan', 'mc g15', 'gloria groove', 'racionais',
    'emicida', 'criolo', 'projota', 'conecrewdiversidad',
    'baco exu do blues', 'muzzike', 'xamã', 'mc hariel', 'mc poze',
    'mc ryan sp', 'mc ig', 'mc kadu', 'mc davi', 'mc menor hr',
  ],
  rock: [
    'queen', 'metallica', 'ac/dc', 'led zeppelin', 'nirvana', 'foo fighters',
    'red hot chili peppers', 'the beatles', 'rolling stones', 'radiohead',
    'green day', 'linkin park', 'system of a down', 'rage against the machine',
    'arctic monkeys', 'the strokes', 'muse', 'coldplay', 'u2',
    'tame impala', 'the killers', 'imagine dragons', 'twenty one pilots',
    'fall out boy', 'panic at the disco', 'my chemical romance', 'paramore',
    'florence and the machine', 'hozier', 'the national', 'vampire weekend',
    // brasileiros rock
    'rita lee', 'legião urbana', 'titãs', 'cazuza', 'raul seixas',
    'os paralamas', 'skank', 'charlie brown jr', 'sepultura', 'planta e raiz',
    'fresno', 'nando reis', 'los hermanos', 'o rappa', 'raimundos',
    // samba / axé
    'casuarina', 'harmonia do samba', 'ivete sangalo', 'chiclete com banana',
    'claudia leitte', 'banda eva', 'olodum', 'timbalada',
  ],
  mpb: [
    'marina sena', 'gal costa', 'caetano veloso', 'djavan', 'tim maia',
    'gilberto gil', 'milton nascimento', 'chico buarque', 'elis regina',
    'ana carolina', 'maria bethânia', 'ivan lins', 'edu lobo', 'nara leão',
    'maria gadú', 'marisa monte', 'jorge ben jor', 'seu jorge',
    'paulinho da viola', 'anavitória', 'vitor kley', 'melim', 'tiago iorc',
    'lenine', 'fagner', 'gonzaguinha', 'belchior', 'geraldo azevedo',
    'zeca baleiro', 'arnaldo antunes', 'paralamas do sucesso',
    // brasileiros modernos soul/mpb
    'liniker', 'urias', 'ebony', 'mahmundi', 'duda beat',
    'luedji luna', 'aziz edipo', 'céu', 'letrux', 'tulipa ruiz',
    'alice caymmi', 'roberta sá', 'francisco el hombre', 'rubel',
    'little simz', 'silvana estrada', 'marília tavares', 'marilia tavares',
  ],
  cowboy: [
    'gusttavo lima', 'jorge e mateus', 'henrique e juliano', 'israel e rodolffo',
    'zé neto e cristiano', 'maiara e maraísa', 'marilia mendonça', 'luan santana',
    'xand avião', 'bell marques', 'joelma', 'banda calypso',
    'dilsinho', 'mumuzinho', 'ferrugem',
    'simone e simaria', 'simone mendes', 'ana castela', 'lauana prado',
    'matheus e kauan', 'hugo e guilherme', 'pedro sampaio', 'chitãozinho e xororó',
    'tarcísio do acordeon', 'tarcisio do acordeon',
    'toby keith', 'luke combs', 'morgan wallen', 'blake shelton', 'garth brooks',
    'zac brown band', 'george strait', 'kenny rogers', 'shania twain',
    'chris stapleton', 'kane brown', 'carrie underwood', 'post malone',
  ],
  pop: [
    // internacionais em alta
    'taylor swift', 'ed sheeran', 'ariana grande', 'billie eilish', 'dua lipa',
    'harry styles', 'the weeknd', 'post malone', 'justin bieber', 'selena gomez',
    'lady gaga', 'katy perry', 'rihanna', 'beyoncé', 'charlie puth',
    'shawn mendes', 'miley cyrus', 'olivia rodrigo', 'lizzo',
    'sam smith', 'sza', 'sabrina carpenter', 'chappell roan', 'gracie abrams',
    'justin timberlake', 'bruno mars', 'michael jackson', 'prince', 'madonna',
    'maroon 5', 'adam levine', 'john legend', 'adele', 'sia', 'p!nk', 'pink',
    'usher', 'ne-yo', 'jason derulo', 'robin thicke', 'pharrell williams',
    'meghan trainor', 'bebe rexha', 'camila cabello', 'fifth harmony',
    'one direction', 'niall horan', 'liam payne', 'zayn', 'louis tomlinson',
    'carly rae jepsen', 'jordin sparks', 'kesha', 'ke$ha', 'nelly furtado',
    'olivia dean', 'charli xcx', 'troye sivan', 'lorde', 'lana del rey', 'halsey',
    'conan gray', 'stephen sanchez', 'chase atlantic', 'renee rapp',
    'victoria monet', 'tate mcrae', 'ice spice', 'pinkpantheress',
    'benson boone', 'noah kahan', 'zach bryan', 'jack harlow',
    // eletropop / alternativo / indie pop
    'lorde', 'banks', 'aurora', 'birdy', 'lennon stella',
    'kiesza', 'ellie goulding', 'zara larsson', 'sigrid', 'astrid s',
    'girl in red', 'wet leg', 'beabadoobee', 'clairo', 'mitski',
    'caroline polachek', 'yeule', 'ethel cain', 'indigo de souza',
    'magdalena bay', 'lucy dacus', 'boygenius', 'julien baker',
    // brasileiros pop / eletropop
    'luísa sonza', 'iza', 'jão', 'alok', 'maraisa',
    'lexa', 'kevinho', 'pedro sampaio', 'claudinho e buchecha',
    'samuel rosa', 'forfun', 'scalene', 'migos brasil',
    // EDM / eletrônico
    'david guetta', 'martin garrix', 'tiesto', 'calvin harris', 'marshmello',
    'alan walker', 'avicii', 'skrillex', 'zedd', 'diplo', 'kygo',
    'vintage culture', 'fisher', 'dom dolla', 'illenium',
    'fred again', 'four tet', 'disclosure', 'flume', 'odesza',
    'rezz', 'deadmau5', 'eric prydz', 'bicep', 'aphex twin',
  ],
};

// ─── Palavras-chave no campo genre ──────────────────────────
const GENRE_KEYWORDS = {
  kpop:   ['k-pop', 'kpop', 'k pop', 'j-pop', 'jpop', 'korean pop', 'japanese pop', 'asian pop', 'mandopop'],
  rap:    ['rap', 'hip hop', 'hip-hop', 'hiphop', 'trap', 'r&b', 'rnb', 'funk carioca', 'funk', 'blues', 'soul'],
  rock:   ['rock', 'metal', 'punk', 'grunge', 'alternative', 'hard rock', 'samba', 'axé', 'axe'],
  mpb:    ['mpb', 'bossa nova', 'música popular brasileira', 'brazilian', 'indie folk', 'acoustic'],
  cowboy: ['sertanejo', 'forró', 'forro', 'country', 'brega', 'sofrência', 'arrocha', 'caipira', 'pagode'],
  pop:    ['pop', 'electropop', 'dance pop', 'synth pop', 'edm', 'dance', 'electronic', 'house', 'techno', 'eletrônico', 'indie pop', 'alt pop', 'dream pop', 'bedroom pop'],
};

// ─── API principal ───────────────────────────────────────────

/**
 * Detecta a variante do mascote com base nas informações da faixa.
 * @param {{ name?: string, artist?: string, genre?: string }} track
 * @returns {keyof typeof MASCOTS}
 */
export function detectMascotVariant(track) {
  if (!track) return 'wave';

  const artist = (track.artist || '').toLowerCase();
  const name   = (track.name   || '').toLowerCase();
  const genre  = (track.genre  || '').toLowerCase();

  // 1. Campo genre (mais confiável — vem da API do player)
  if (genre) {
    for (const [variant, kws] of Object.entries(GENRE_KEYWORDS)) {
      if (kws.some(k => genre.includes(k))) return variant;
    }
  }

  // 2. Artista conhecido na lista curada
  for (const [variant, artists] of Object.entries(GENRE_ARTISTS)) {
    if (artists.some(a => artist.includes(a))) return variant;
  }

  // 3. Palavras-chave no artista + título da música
  const combined = `${artist} ${name}`;
  for (const [variant, kws] of Object.entries(GENRE_KEYWORDS)) {
    if (kws.some(k => combined.includes(k))) return variant;
  }

  return 'wave'; // fallback: UnikoWave geral
}

/**
 * Retorna uma fala aleatória para o mascote.
 * @param {keyof typeof MASCOTS} variant
 * @returns {string}
 */
export function getRandomLine(variant) {
  const lines = MASCOTS[variant]?.lines ?? MASCOTS.wave.lines;
  return lines[Math.floor(Math.random() * lines.length)];
}
