import type { components } from './pokeapi'

export type Pokemon = components['schemas']['Pokemon']

const API_BASE_URL = 'https://pokeapi.co/api/v2'

export async function getPokemon(nameOrId: string): Promise<Pokemon> {
  const safeNameOrId = encodeURIComponent(nameOrId.trim().toLowerCase())
  const response = await fetch(`${API_BASE_URL}/pokemon/${safeNameOrId}`)

  if (response.status === 404) {
    throw new Error('Not found. Try "pikachu", "eevee", or "25".')
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json() as Promise<Pokemon>
}
