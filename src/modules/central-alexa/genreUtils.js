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
import UnikoGospelImg from '../../assets/UnikoGospel.png';

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
    title: 'Voz da Multidão',
    lines: [
      'Vamos mudar o mundo com a música! 🌟',
      'Uau! Todas as músicas soam incríveis! 🎵',
      'Espero não me perder em meio de tanta música. 🌸',
      'A alegria é silenciosa demais sem a tristeza na batida. 💜',
      'Sigam minha voz! 🎤',
      'Sua música vai ficar na minha cabeça. ✨',
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

  gospel: {
    img:   UnikoGospelImg,
    name:  'UnikoGospel',
    title: 'DJ da Fé',
    lines: [
      'A fé move montanhas e o som move almas! 🙏',
      'Esse louvor chegou no coração! ✨',
      'Glória! Que música abençoada! 🕊️',
      'O Senhor é bom, e esse som também! 🎶',
      'Louvor que transforma! Que mensagem linda! 💫',
      'Sintam a presença nessa melodia! 🌟',
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
      'Brasil que canta, Brasil que sente! 🌿',
      'Essa batida toca fundo no peito 💛',
      'Do baião ao samba, tudo é Brasil 🥁',
      'Chico, Gil, Caetano... a alma não envelhece 🎸',
      'Música boa não tem pressa, tem alma 🍂',
      'Sinto o Rio nessa melodia 🌊',
    ],
  },
};

// ─── Artistas mapeados por gênero ───────────────────────────
const GENRE_ARTISTS = {
  gospel: [
    // gospel / louvor evangélico
    'gabriela rocha', 'aline barros', 'fernanda brum', 'fernandinho',
    'diante do trono', 'hillsong', 'elevation worship', 'bethel music',
    'jesus culture', 'planetshakers', 'tom e julieta', 'thalles roberto',
    'léa mendonça', 'lea mendonca', 'bruna karla', 'isadora pompeo',
    'anderson freire', 'daniel & samuel', 'davi sacer', 'rodolfo abrantes',
    'preto no branco', 'jotta a', 'Ana Paula Valadão', 'ana paula valadao',
    'novo tempo', 'voz da verdade', 'eyshila', 'cassiane', 'shirley carvalhaes',
    'paulo cesar baruk', 'regis danese', 'ids', 'livres para adorar',
    'heróis da fé', 'herois da fe', 'damares', 'laura souguellis',
    // católico
    'padre zezinho', 'padre reginaldo manzotti', 'padre marcelo rossi',
    'anjos de resgate', 'comunidade shalom', 'saltasã', 'vida reluz',
  ],
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
    'ebony', 'ajuliacosta', 'a julia costa', 'nanda tsunami',
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
    'liniker', 'urias', 'mahmundi', 'duda beat',
    'luedji luna', 'aziz edipo', 'céu', 'letrux', 'tulipa ruiz',
    'alice caymmi', 'roberta sá', 'francisco el hombre', 'rubel',
    'little simz', 'silvana estrada', 'marília tavares', 'marilia tavares',
    // obs: ebony, ajuliacosta e nanda tsunami estão no rap
    // obs: alceu valença, elba ramalho, geraldo azevedo estão no cowboy
  ],
  cowboy: [
    'gusttavo lima', 'jorge e mateus', 'henrique e juliano', 'israel e rodolffo',
    'zé neto e cristiano', 'maiara e maraísa', 'marilia mendonça', 'luan santana',
    'xand avião', 'bell marques', 'joelma', 'banda calypso',
    'dilsinho', 'mumuzinho', 'ferrugem',
    'simone e simaria', 'simone mendes', 'ana castela', 'lauana prado',
    'matheus e kauan', 'hugo e guilherme', 'pedro sampaio', 'chitãozinho e xororó',
    'tarcísio do acordeon', 'tarcisio do acordeon',
    'pablo do arrocha', 'joão gomes', 'joao gomes', 'mari fernandez',
    'nason', 'seu desejo', 'felipe amorim', 'nattan',
    'marília mendonça', 'pablo',
    'wesley safadão', 'léo santana', 'leo santana', 'naiara azevedo',
    'barões da pisadinha', 'zé vaqueiro', 'ze vaqueiro', 'tierry',
    'solange almeida', 'tayrone', 'calcinha preta', 'aviões do forró',
    'avioes do forro', 'forró do tico', 'dorgival dantas', 'limão com mel',
    'limao com mel', 'mastruz com leite', 'raí saia rodada', 'banda magnifica',
    'geraldinho lins', 'flávio josé', 'flavio jose', 'companhia do calypso',
    'leo foguete', 'alceu valença', 'alceu valenca', 'elba ramalho',
    'geraldo azevedo', 'luiz gonzaga',
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
  gospel: [
    // genre tags do Spotify
    'gospel', 'louvor', 'worship', 'cristão', 'cristao', 'evangélico', 'evangelico',
    'católico', 'catolico', 'ccm', 'christian', 'praise',
    // palavras típicas em títulos de músicas gospel
    'jesus', 'aleluia', 'aleluiah', 'hallelujah', 'hosana',
    'bênção', 'bencao', 'benção', 'bençao',
    'salvação', 'salvacao', 'avivamento',
    'adoração', 'adoracao', 'oração', 'oracao',
    'espírito santo', 'espirito santo', 'ungido',
    'glória a deus', 'gloria a deus', 'deus é fiel', 'deus e fiel',
    'amém', 'amen', 'milagre', 'cura divina', 'tua graça',
    'senhor te amo', 'teu nome', 'rei dos reis',
  ],
  kpop: [
    'k-pop', 'kpop', 'k pop', 'j-pop', 'jpop', 'korean pop', 'japanese pop',
    'asian pop', 'mandopop', 'korean r&b', 'k-rap', 'k-indie', 'j-rock',
  ],
  rap: [
    'rap', 'hip hop', 'hip-hop', 'hiphop', 'trap', 'r&b', 'rnb',
    'drill', 'phonk', 'trap soul', 'melodic rap', 'dark trap',
    'conscious hip hop', 'gangsta rap', 'southern hip hop',
    'lo-fi hip hop', 'lofi hip hop', 'funk carioca', 'funk ostentação',
    'funk', 'blues', 'soul',
  ],
  rock: [
    // tags específicas — NÃO usar "alternative" sozinho pois bate em "alternative pop"
    'alternative rock', 'alternative metal', 'indie rock', 'classic rock',
    'hard rock', 'punk rock', 'post-punk', 'new wave', 'emo', 'metalcore',
    'post-grunge', 'progressive rock', 'britpop', 'noise rock', 'garage rock',
    'rock', 'metal', 'punk', 'grunge', 'samba', 'axé', 'axe',
  ],
  mpb: [
    'mpb', 'bossa nova', 'música popular brasileira', 'samba-rock',
    'pagode romântico', 'brazilian', 'indie folk', 'acoustic',
  ],
  cowboy: [
    'sertanejo', 'sertanejo universitário', 'sertanejo pop', 'forró', 'forro',
    'forró eletrônico', 'xote', 'baião', 'country', 'brega', 'sofrência',
    'arrocha', 'caipira', 'pagode',
  ],
  pop: [
    // tags compostas primeiro — mais específicas que "pop" sozinho
    'alternative pop', 'art pop', 'chamber pop', 'power pop', 'bubblegum pop',
    'teen pop', 'europop', 'cantopop', 'electropop', 'dance pop', 'synth pop',
    'indie pop', 'alt pop', 'dream pop', 'bedroom pop', 'hyperpop',
    'pop rap', 'pop rock', 'pop soul',
    'edm', 'dance', 'electronic', 'house', 'techno', 'eletrônico',
    'pop',
  ],
};

// ─── API principal ───────────────────────────────────────────

// Termos curtos (≤ 4 chars) exigem fronteira de palavra para evitar falsos positivos.
// Ex: 'eve' não pode bater em 'azevedo'; 'ado' não pode bater em 'fernando'.
function matchesArtist(fullArtist, term) {
  if (term.length > 4) return fullArtist.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s,&/])${escaped}(?:[\\s,&/]|$)`).test(fullArtist);
}

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
    if (artists.some(a => matchesArtist(artist, a))) return variant;
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
