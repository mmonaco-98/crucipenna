# Modello EMNIST per CruciPenna

Questa cartella deve contenere un modello TensorFlow.js per il riconoscimento di lettere maiuscole scritte a mano, addestrato su EMNIST Letters o dataset compatibile.

---

## File richiesti

| File                   | Descrizione                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `model.json`           | Architettura + riferimenti ai pesi (formato `LayersModel` TF.js) |
| `group1-shard1of1.bin` | Pesi del modello (il nome può variare)                           |

L'app carica da: `/models/emnist/model.json`

---

## Requisiti del modello

- **Input:** tensore `[1, 28, 28, 1]` — immagine in scala di grigi, valori in `[0, 1]` dove `1` è tratto nero
- **Output:** vettore di 26 logit (uno per lettera, indice 0 = A … 25 = Z)
- **Formato:** `LayersModel` TensorFlow.js (compatibile con `tf.loadLayersModel`)

---

## Opzione 1 — Convertire un modello Keras esistente

Se hai già un modello `.h5` o `SavedModel` addestrato su EMNIST Letters:

```bash
pip install tensorflowjs

# da SavedModel
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_layers_model \
  /path/to/saved_model \
  public/models/emnist/

# da Keras .h5
tensorflowjs_converter \
  --input_format=keras \
  /path/to/model.h5 \
  public/models/emnist/
```

---

## Opzione 2 — Usare un modello preaddestrato da Hugging Face / TFJS Hub

Alcuni modelli EMNIST Letters già convertiti in TF.js sono disponibili pubblicamente. Cerca `emnist letters tfjs` su Hugging Face o GitHub.

Assicurati che il modello rispetti i requisiti di input/output descritti sopra (26 classi, input 28×28×1, normalizzato con sfondo bianco = 0).

---

## Opzione 3 — Addestrare da zero (script Python minimale)

```python
import tensorflow as tf
from emnist import extract_training_samples, extract_test_samples

x_train, y_train = extract_training_samples("letters")
x_test, y_test = extract_test_samples("letters")

# Normalizza e porta a [0,1], sfondo bianco -> 0
x_train = x_train.astype("float32") / 255.0
x_test  = x_test.astype("float32") / 255.0

# EMNIST Letters usa etichette 1-26; porta a 0-25
y_train -= 1
y_test  -= 1

x_train = x_train[..., tf.newaxis]
x_test  = x_test[..., tf.newaxis]

model = tf.keras.Sequential([
    tf.keras.layers.Conv2D(32, 3, activation="relu", input_shape=(28, 28, 1)),
    tf.keras.layers.MaxPooling2D(),
    tf.keras.layers.Conv2D(64, 3, activation="relu"),
    tf.keras.layers.MaxPooling2D(),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(128, activation="relu"),
    tf.keras.layers.Dense(26),
])

model.compile(
    optimizer="adam",
    loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    metrics=["accuracy"],
)

model.fit(x_train, y_train, epochs=10, validation_data=(x_test, y_test))
model.save("emnist_letters.h5")
```

Poi converti con `tensorflowjs_converter` come nell'Opzione 1.

---

## Verifica dell'installazione

Avvia `npm run dev` e apri l'app. Nel pannello **Stato input** vedrai:

- `Modello handwriting: caricamento...` mentre TF.js scarica i pesi
- `Modello handwriting: pronto` se model.json e shard sono corretti
- `Modello handwriting: non disponibile` se i file mancano o il formato non è compatibile

---

## Disattivazione

Per disattivare il riconoscimento senza rimuovere i file:

```
VITE_ENABLE_HANDWRITING=false npm run dev
```
