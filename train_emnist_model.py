#!/usr/bin/env python3
"""
train_emnist_model.py
======================
Addestra una CNN su EMNIST Letters (26 classi, A-Z maiuscole) e la scrive
direttamente nel formato TensorFlow.js LayersModel, pronta per CruciPenna.

Requisiti soddisfatti:
  Input  : [1, 28, 28, 1] float32 in [0,1], 1 = tratto (inchiostro)
  Output : 26 logit (indice 0 = A ... 25 = Z)
  Formato: LayersModel TF.js (tf.loadLayersModel compatibile)
  Output : public/models/emnist/model.json + group1-shard1of1.bin

USO
---
1) Setup (una-tantum):

    bash setup_env.sh

2) Training completo (scarica ~500 MB la prima volta, cached poi):

    python train_emnist_model.py

3) Test rapido della pipeline (pochi minuti, bassa accuratezza):

    python train_emnist_model.py --quick-test

4) Opzioni:

    --epochs N        numero di epoche (default 15, early stopping attivo)
    --batch-size N    batch size (default 256)
    --no-augmentation training più rapido, meno robusto su tratto reale
    --out PATH        cartella output (default: public/models/emnist)

NOTE SU EMNIST
--------------
EMNIST Letters (tensorflow-datasets):
  - Etichette 1-26 → riportate a 0-25 nello script
  - Le immagini sono ruotate/specchiate rispetto all'orientamento naturale
    (bug del formato Matlab NIST originale): viene applicato un fix standard
    (transpose degli assi riga/colonna) per riportarle dritte.
  - Valori pixel 0 = sfondo, 255 = inchiostro → dopo /255 si ottiene
    direttamente "1 = tratto" come richiesto dall'app.

CONVERSIONE TF.JS
-----------------
Lo script scrive il LayersModel senza usare il pacchetto Python tensorflowjs
(che dipende da tensorflow-decision-forests, incompatibile con il runtime
protobuf 5.x richiesto da tensorflow 2.19 su Apple Silicon + Python 3.12).
Il formato LayersModel è semplice e stabile: model.json con topologia Keras 2
+ weightsManifest, più un file .bin con i pesi float32 concatenati.
"""

import argparse
import json
import os

# Deve essere impostato PRIMA di qualsiasi import di tensorflow/keras.
# Da TF 2.16 in poi tf.keras punta a Keras 3; TF_USE_LEGACY_KERAS=1 forza
# tf-keras (Keras 2), il cui formato model.to_json() è quello che TF.js
# si aspetta per tf.loadLayersModel.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import numpy as np

LETTERS = [chr(ord("A") + i) for i in range(26)]


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

def fix_emnist_orientation(images: np.ndarray) -> np.ndarray:
    """
    EMNIST (formato Matlab originale) salva le immagini ruotate di 90° e
    specchiate. Questo fix (transpose degli assi riga/colonna) è lo standard
    della community per riportarle nell'orientamento naturale di lettura.

    images: array shape (N, 28, 28) o (N, 28, 28, 1)
    """
    squeeze = images.ndim == 4
    if squeeze:
        images = images[..., 0]
    fixed = np.transpose(images, (0, 2, 1))
    return fixed[..., np.newaxis] if squeeze else fixed


def load_emnist_letters(quick_test: bool = False):
    import tensorflow_datasets as tfds

    print("Scaricamento / caricamento EMNIST Letters (tensorflow-datasets)...")
    ds_train, ds_test = tfds.load(
        "emnist/letters",
        split=["train", "test"],
        as_supervised=True,
        batch_size=-1,
    )
    x_train, y_train = tfds.as_numpy(ds_train)
    x_test, y_test   = tfds.as_numpy(ds_test)

    x_train = x_train.astype("float32")
    x_test  = x_test.astype("float32")
    y_train = y_train.astype("int64")
    y_test  = y_test.astype("int64")

    if quick_test:
        x_train, y_train = x_train[:4000], y_train[:4000]
        x_test,  y_test  = x_test[:1000],  y_test[:1000]

    return (x_train, y_train), (x_test, y_test)


def preprocess(x_train, y_train, x_test, y_test):
    x_train = fix_emnist_orientation(x_train)
    x_test  = fix_emnist_orientation(x_test)

    # Normalizza in [0,1]: 1 = inchiostro
    x_train = x_train / 255.0
    x_test  = x_test  / 255.0

    # Etichette EMNIST: 1-26 → 0-25
    y_train = y_train - 1
    y_test  = y_test  - 1

    assert y_train.min() >= 0 and y_train.max() <= 25, \
        f"Etichette fuori range: [{y_train.min()}, {y_train.max()}]"
    assert x_train.shape[1:] == (28, 28, 1), \
        f"Shape inattesa: {x_train.shape}"

    return x_train, y_train, x_test, y_test


# ---------------------------------------------------------------------------
# Modello
# ---------------------------------------------------------------------------

def build_model():
    import tensorflow as tf

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(28, 28, 1)),

        tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu"),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.Dropout(0.25),

        tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu"),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.Dropout(0.25),

        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(256, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Dense(26),  # logit, niente softmax
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=["accuracy"],
    )
    return model


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(model, x_train, y_train, x_test, y_test,
          epochs, batch_size, use_augmentation):
    import tensorflow as tf

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy", patience=4, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6
        ),
    ]

    if use_augmentation:
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
        aug = ImageDataGenerator(
            rotation_range=12,
            width_shift_range=0.08,
            height_shift_range=0.08,
            zoom_range=0.1,
            shear_range=8,
            fill_mode="constant",
            cval=0.0,
        )
        history = model.fit(
            aug.flow(x_train, y_train, batch_size=batch_size),
            steps_per_epoch=len(x_train) // batch_size,
            epochs=epochs,
            validation_data=(x_test, y_test),
            callbacks=callbacks,
        )
    else:
        history = model.fit(
            x_train, y_train,
            batch_size=batch_size,
            epochs=epochs,
            validation_data=(x_test, y_test),
            callbacks=callbacks,
        )
    return history


def evaluate_and_report(model, x_test, y_test):
    loss, acc = model.evaluate(x_test, y_test, verbose=0)
    print(f"\nAccuratezza finale sul test set: {acc * 100:.2f}%  (loss: {loss:.4f})")

    idx = np.random.choice(len(x_test), size=10, replace=False)
    logits = model.predict(x_test[idx], verbose=0)
    preds  = np.argmax(logits, axis=1)

    print("\nEsempi di predizione (atteso -> predetto):")
    for i, pred in zip(idx, preds):
        atteso   = LETTERS[y_test[i]]
        predetto = LETTERS[pred]
        flag = "OK" if atteso == predetto else "X "
        print(f"  [{flag}] {atteso} -> {predetto}")


# ---------------------------------------------------------------------------
# Conversione TF.js (senza pacchetto tensorflowjs)
# ---------------------------------------------------------------------------

def save_tfjs_model(model, out_dir: str) -> None:
    """
    Scrive il modello nel formato LayersModel di TensorFlow.js:

      model.json            — topologia Keras 2 + weightsManifest
      group1-shard1of1.bin  — pesi float32 little-endian concatenati

    Non usa il pacchetto Python 'tensorflowjs', che trascina
    'tensorflow-decision-forests' e soffre di conflitti protobuf gencode/runtime
    su Apple Silicon con Python 3.12 e tensorflow 2.19.

    Formato verificato compatibile con tf.loadLayersModel (TF.js ≥ 3.x).

    Convenzione nomi pesi:
      tf-keras assegna nomi come 'conv2d/kernel:0'.
      TF.js, quando ricostruisce il modello dalla topologia e carica i pesi,
      usa gli stessi nomi ma senza il suffisso ':0'.
      Lo script rimuove ':0' prima di scrivere il manifesto.
    """
    os.makedirs(out_dir, exist_ok=True)

    # --- pesi ---
    weight_specs = []
    buffer = bytearray()

    for w in model.weights:
        arr  = w.numpy().astype(np.float32)
        name = w.name[:-2] if w.name.endswith(":0") else w.name
        weight_specs.append({
            "name":  name,
            "shape": list(arr.shape),
            "dtype": "float32",
        })
        buffer.extend(arr.tobytes())   # C-order, little-endian float32

    bin_file = "group1-shard1of1.bin"
    with open(os.path.join(out_dir, bin_file), "wb") as f:
        f.write(buffer)

    # --- topologia ---
    # model.to_json() in tf-keras (Keras 2) produce il formato che TF.js
    # si aspetta per tf.loadLayersModel: oggetto con class_name, config,
    # keras_version, backend — coincide esattamente con modelTopology.
    model_topology = json.loads(model.to_json())

    model_json = {
        "format":       "layers-model",
        "generatedBy":  f"keras {model_topology.get('keras_version', '2.x')}",
        "convertedBy":  "train_emnist_model.py (CruciPenna)",
        "modelTopology": model_topology,
        "weightsManifest": [
            {
                "paths":   [bin_file],
                "weights": weight_specs,
            }
        ],
    }

    json_path = os.path.join(out_dir, "model.json")
    with open(json_path, "w") as f:
        json.dump(model_json, f)

    json_kb = os.path.getsize(json_path) / 1024
    bin_kb  = len(buffer) / 1024
    print(f"\nConversione TF.js completata → {out_dir}")
    print(f"  model.json              ({json_kb:.1f} KB)")
    print(f"  {bin_file}  ({bin_kb:.1f} KB)")
    print(f"  Totale tensori: {len(weight_specs)}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--epochs",           type=int,  default=15)
    parser.add_argument("--batch-size",       type=int,  default=256)
    parser.add_argument("--no-augmentation",  action="store_true")
    parser.add_argument(
        "--quick-test",
        action="store_true",
        help="Allena su un sottoinsieme piccolo per verificare la pipeline "
             "(accuratezza bassa, normale)",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=os.path.join("public", "models", "emnist"),
        help="Cartella di output (default: public/models/emnist)",
    )
    args = parser.parse_args()

    # Caricamento e preprocessing
    (x_train, y_train), (x_test, y_test) = load_emnist_letters(
        quick_test=args.quick_test
    )
    x_train, y_train, x_test, y_test = preprocess(
        x_train, y_train, x_test, y_test
    )
    print(f"Train: {x_train.shape}  Test: {x_test.shape}")

    # Modello
    model = build_model()
    model.summary()

    # Training
    train(
        model, x_train, y_train, x_test, y_test,
        epochs=args.epochs,
        batch_size=args.batch_size,
        use_augmentation=not args.no_augmentation,
    )

    # Valutazione
    evaluate_and_report(model, x_test, y_test)

    # Conversione TF.js diretta (senza tensorflowjs né subprocess)
    save_tfjs_model(model, args.out)

    print("\nFatto. Avvia 'npm run dev' e controlla nel pannello Stato input:")
    print("  'Modello handwriting: pronto'")


if __name__ == "__main__":
    main()