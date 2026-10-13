# sarxina.com

My homepage: the library illustration, alive in the browser, with everything I do one tap away.

## Dev

```
npm install
npm run dev
```

## Changing things

- Links, the next stream, the tools shelf and the credits: `src/data/site.ts`.
- The scene: `src/scene/engine.ts` draws the illustration's separate pieces on a canvas. The pieces and their joints
  are in `public/scene/` (`rig.json` plus one picture per piece).

## Deploy

Hosted on AWS Amplify. Pushes to `main` build and deploy.

## Routes

- `/` the homepage
- `/pluginmanager` redirects to the latest Sarxina Plugin Manager release
- `/privacy/`, `/terms/`
