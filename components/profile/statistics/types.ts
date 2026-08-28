export interface DanceStat {
  datum: string
  idopont: string
  f: number
  l: number
  p: number
  h: number
  sz: number
  ex: number
  hobbi: number
  Össz: number
}

export interface Attendee {
  nev: string
  nem: string
  par_neve: string | null
  tudasszint: string | null
}

export interface EventStat {
  event_id: string
  event_title: string
  event_date: string | null
  jelentkezett_count: number
  megjelent_count: number
  fizetett_megjelent_count: number
  megjelenesi_arany: string
  fizetesi_arany: string
}

export interface PersonStat {
  profile_id: string
  full_name: string
  email: string | null
  osszes_jelentkezes: number
  osszes_megjelent: number
  osszes_fizetett_megjelent: number
  megjelenesi_arany: string
  fizetesi_arany: string
}