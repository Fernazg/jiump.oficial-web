// Detección de referencias bíblicas en el texto (ej.: «Romanos 1:17»,
// «1 Corintios 13:4-7», «Efesios 2:8-9»). Se resaltan automáticamente.

const LIBROS = [
  'Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio', 'Josué', 'Jueces', 'Rut',
  '1 Samuel', '2 Samuel', '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras', 'Nehemías',
  'Ester', 'Job', 'Salmos', 'Salmo', 'Proverbios', 'Eclesiastés', 'Cantares', 'Isaías', 'Jeremías',
  'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas', 'Joel', 'Amós', 'Abdías', 'Jonás', 'Miqueas',
  'Nahúm', 'Habacuc', 'Sofonías', 'Hageo', 'Zacarías', 'Malaquías',
  'Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos', 'Romanos', '1 Corintios', '2 Corintios', 'Gálatas',
  'Efesios', 'Filipenses', 'Colosenses', '1 Tesalonicenses', '2 Tesalonicenses', '1 Timoteo',
  '2 Timoteo', 'Tito', 'Filemón', 'Hebreos', 'Santiago', '1 Pedro', '2 Pedro', '1 Juan', '2 Juan',
  '3 Juan', 'Judas', 'Apocalipsis',
];

const libros = [...LIBROS].sort((a, b) => b.length - a.length).map((l) => l.replace(/ /g, '\\s'));

/** Libro + capítulo, con versículos opcionales: «Juan 3», «Juan 3:16», «Juan 3:16-18», «Juan 3:16, 18». */
export const REFERENCIA_BIBLICA = new RegExp(
  `(?<![\\p{L}\\d])(?:${libros.join('|')})\\s\\d{1,3}(?::\\d{1,3}(?:[-–]\\d{1,3})?(?:,\\s?\\d{1,3}(?:[-–]\\d{1,3})?)*)?(?![\\p{L}\\d])`,
  'gu',
);
