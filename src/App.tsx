import { useState, type FormEvent } from 'react'
import { getPokemon, type Pokemon } from './api/pokemon'
import './App.css'

function App() {
  const [query, setQuery] = useState('pikachu')
  const [pokemon, setPokemon] = useState<Pokemon | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await getPokemon(query)
      setPokemon(result)
    } catch (caughtError) {
      setPokemon(null)
      setError(caughtError instanceof Error ? caughtError.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="section-label">Free OpenAPI playground</p>
        <h1>無料APIでバイブコーディングする土台</h1>
        <p className="lead">
          APIキーなしの PokeAPI を OpenAPI 定義から型生成して、React + TypeScript
          で安全に叩くミニアプリです。
        </p>

        <form className="search-card" onSubmit={handleSubmit}>
          <label htmlFor="pokemon-query">Pokemon name or ID</label>
          <div className="search-row">
            <input
              id="pokemon-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="pikachu"
            />
            <button type="submit" disabled={isLoading || query.trim().length === 0}>
              {isLoading ? 'Loading...' : 'Fetch'}
            </button>
          </div>
        </form>
      </section>

      <section className="result-panel" aria-live="polite">
        {error && <p className="error">{error}</p>}

        {!error && !pokemon && (
          <div className="empty-state">
            <h2>まずは検索してみよう</h2>
            <p>`pikachu`, `eevee`, `charizard`, `25` などが使えます。</p>
          </div>
        )}

        {pokemon && (
          <article className="pokemon-card">
            <div className="sprite-frame">
              {pokemon.sprites.front_default ? (
                <img src={pokemon.sprites.front_default} alt={pokemon.name} />
              ) : (
                <span>No sprite</span>
              )}
            </div>
            <div>
              <p className="pokemon-number">#{pokemon.id}</p>
              <h2>{pokemon.name}</h2>
              <dl className="stats">
                <div>
                  <dt>Height</dt>
                  <dd>{pokemon.height / 10} m</dd>
                </div>
                <div>
                  <dt>Weight</dt>
                  <dd>{pokemon.weight / 10} kg</dd>
                </div>
              </dl>
              <div className="chips">
                {pokemon.types.map(({ type }) => (
                  <span key={type.name}>{type.name}</span>
                ))}
              </div>
              <p className="abilities">
                Abilities: {pokemon.abilities.map(({ ability }) => ability.name).join(', ')}
              </p>
            </div>
          </article>
        )}
      </section>
    </main>
  )
}

export default App
