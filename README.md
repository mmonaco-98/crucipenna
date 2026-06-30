# CruciPenna

PWA cruciverba ottimizzata per iPad, con input touch/tastiera e struttura pronta per Apple Pencil handwriting.

## Stack

- React + Vite + TypeScript
- `vite-plugin-pwa`
- TensorFlow.js (integrazione pronta, attualmente disattivata)

## Avvio locale

```bash
npm install
npm run dev
```

Build produzione:

```bash
npm run build
```

## Dataset EVALITA (gia' incluso localmente)

I file sorgente sono in `dataset/`:

- `train_grids_empty.txt`
- `train_grids_gold.txt`
- `train_cross_clues.jsonl`

Conversione nel formato dell'app:

```bash
npm run convert:evalita -- \
  --empty dataset/train_grids_empty.txt \
  --gold dataset/train_grids_gold.txt \
  --clues dataset/train_cross_clues.jsonl \
  --out src/data/puzzles/generated \
  --limit 500
```

Output: file JSON in `src/data/puzzles/generated/` (`puzzle-001.json` ...).

## Stato handwriting

Il riconoscimento e' attivo in app quando il modello e' disponibile.

Configurazione:

1. Inserisci un modello TF.js in `public/models/emnist/` (almeno `model.json` + shard `.bin`).
2. Il caricamento usa il path `/models/emnist/model.json`.
3. Puoi disattivarlo impostando `VITE_ENABLE_HANDWRITING=false` nell'ambiente.

## PWA su iPad

Sono gia' configurati:

- manifest PWA via `vite-plugin-pwa`
- service worker auto-update
- meta tag iOS standalone in `index.html`
- icone in `public/icons/`

Per test reale: apri da Safari su iPad e usa "Aggiungi alla schermata Home".
