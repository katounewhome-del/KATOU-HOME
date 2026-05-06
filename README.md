# Free OpenAPI Vibe Coding Starter

無料・APIキー不要の [PokeAPI](https://pokeapi.co/) を題材にした React + TypeScript + OpenAPI のスターターです。

## 使い方

```bash
npm.cmd run generate:api
npm.cmd run dev
```

PowerShellで `npm` が実行ポリシーに止められる場合は、このプロジェクトでは `npm.cmd` を使ってください。

## 何が入っているか

- `openapi/pokeapi.yaml`: 外部APIのOpenAPI定義
- `src/api/pokeapi.ts`: OpenAPI定義から生成されるTypeScript型
- `src/api/pokemon.ts`: 型を使ったfetch関数
- `src/App.tsx`: 無料APIを叩く検索UI

## APIを変えたいとき

1. `openapi/pokeapi.yaml` を別APIのOpenAPI定義に差し替える
2. `npm.cmd run generate:api` を実行する
3. `src/api/*.ts` と画面側を新しい型に合わせて編集する

OpenAI APIのような有料/クレジット制APIではなく、無料で試したい場合は「APIキー不要」「CORS対応」「OpenAPI仕様あり」のAPIを選ぶとスムーズです。
