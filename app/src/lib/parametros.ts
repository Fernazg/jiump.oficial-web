/**
 * Parámetros de la URL (?q=…&serie=…) como textos simples.
 *
 * Una dirección escrita a mano o por un robot puede traer un parámetro
 * repetido (?q=a&q=b llega como lista), caracteres de control o textos
 * enormes. Sin limpiar, eso terminaba en un error 500. Aquí cada valor queda
 * como un texto corto y seguro, o no queda.
 */
export function textoDeParametro(valor: unknown, max = 200): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (typeof v !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex -- justamente se quitan los caracteres de control
  const limpio = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  return limpio || undefined;
}

export async function parametros<T extends Record<string, string | undefined>>(searchParams: Promise<T>, max = 200): Promise<T> {
  const crudos = (await searchParams) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(crudos).map(([k, v]) => [k, textoDeParametro(v, max)])) as T;
}
