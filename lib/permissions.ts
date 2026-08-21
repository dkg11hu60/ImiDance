import { supabase } from './supabase'

// A belépett user szerepéhez tartozó látható objektum-kulcsok betöltése.
// A döntés forrása az object_roles tábla, nem a kód. Új jogosultsághoz
// egy sor kerül a táblába (vagy egy új szerep), a komponensek nem változnak.
export async function loadVisibleObjects(role: string | null | undefined): Promise<Set<string>> {
  if (!role) return new Set()

  const { data, error } = await supabase
    .from('object_roles')
    .select('object_key')
    .eq('role_key', role)

  if (error || !data) return new Set()
  return new Set(data.map((r: any) => r.object_key))
}
