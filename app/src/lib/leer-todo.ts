/**
 * Lee TODAS las filas de una consulta, por tramos.
 *
 * Supabase entrega como máximo 1.000 filas por consulta y no avisa cuando
 * corta. Con una biblioteca de más de 1.000 fotos, las listas quedaban
 * incompletas sin ningún error. Esta función pide tramos de 1.000 hasta
 * terminar. La consulta debe tener un orden estable (por ejemplo, con «id»
 * como desempate) para que los tramos no se pisen.
 */
const TRAMO = 1000;
const MAX_TRAMOS = 50; // 50.000 filas: tope de seguridad

type Resultado = { data: unknown; error: { message: string } | null };

export async function leerTodo<T>(consulta: (desde: number, hasta: number) => PromiseLike<Resultado>, que = 'los datos'): Promise<T[]> {
  const todo: T[] = [];
  for (let i = 0; i < MAX_TRAMOS; i++) {
    const { data, error } = await consulta(i * TRAMO, (i + 1) * TRAMO - 1);
    if (error) throw new Error(`No se pudo leer ${que}: ${error.message}`);
    const filas = (data ?? []) as T[];
    todo.push(...filas);
    if (filas.length < TRAMO) break;
  }
  return todo;
}
