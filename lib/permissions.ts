import { supabase } from './supabase'

// A belépett user szerepéhez tartozó látható objektum-kulcsok betöltése.
// A döntés forrása az object_roles tábla, nem a kód. Új jogosultsághoz
// egy sor kerül a táblába (vagy egy új szerep), a komponensek nem változnak.

export async function loadVisibleObjects(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set()

  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('role_key')
    .eq('user_id', userId)

  if (roleError || !userRoles || userRoles.length === 0) return new Set()

  const roleKeys = userRoles.map((r: any) => r.role_key)

  const { data, error } = await supabase
    .from('object_roles')
    .select('object_key')
    .in('role_key', roleKeys)

  if (error || !data) return new Set()
  
  return new Set(data.map((r: any) => r.object_key))
}