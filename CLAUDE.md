## Design rules

1. Use jordy-ui for shared design values. Shared tokens come from `jordy-ui/dist/tokens.css`, imported in `app/globals.css`. Do not copy their values into this repo. This dashboard uses plain CSS and is phone-first. Do not add Tailwind or jordy-ui components unless a task asks for it.
2. No hard-coded hex colours in components. Use tokens. Tokens that are local to this dashboard belong in `app/globals.css`.
3. Never edit shared components in this repo. Change them in the jordy-design-system repo, release a new version, then update the pinned version here.
