#!/usr/bin/env python3
"""
train_emnist_model.py
======================
Addestra una CNN su EMNIST Letters (26 classi, A-Z maiuscole) e la converte
in formato TensorFlow.js LayersModel, pronta per essere usata da CruciPenna.

Requisiti soddisfatti:
- Input:  [1, 28, 28, 1] float32 in [0,1], 1 = tratto (inchiostro)
- Output: 26 logit (indice 0 = A ... 25 = Z)
- Formato: tfjs LayersModel (tf.loadLayersModel compatibile)
- Destinazione finale: public/models/emnist/model.json + group1-shard*.bin

USO
---
1) Crea un virtualenv e installa le dipendenze:

    python3 -m venv venv
    source venv/bin/activate          # Windows: venv\\Scripts\\activate
    pip install tensorflow tensorflow-datasets tensorflowjs numpy matplotlib

2) Lancia lo script dalla root del progetto (quella che contiene "public/"):

    python train_emnist_model.py

   Lo script scarica EMNIST Letters automaticamente (~500MB la prima volta,
   tensorflow-datasets se lo tiene in cache in ~/tensorflow_datasets),
   allena il modello, e scrive direttamente in:

       public/models/emnist/model.json
       public/models/emnist/group1-shard1of1.bin   (o più shard se grande)

   Se vuoi un output path diverso, usa --out:

    python train_emnist_model.py --out public/models/emnist

3) Verifica:

    npm run dev
    # Nel pannello "Stato input" dell'app dovresti vedere
    # "Modello handwriting: pronto"

OPZIONI UTILI
-------------
--epochs N          numero di epoche (default 15, early stopping attivo)
--batch-size N       dimensione batch (default 256)
--no-augmentation    disattiva la data augmentation (training più rapido, meno robusto)
--quick-test         allena su un sottoinsieme piccolo solo per verificare che la pipeline funzioni

NOTE SU EMNIST
--------------
EMNIST Letters in tensorflow-datasets:
- Etichette 1..26 (1=A ... 26=Z) -> nello script vengono riportate a 0..25
- Le immagini in EMNIST (derivate dal formato Matlab originale del NIST)
  sono ruotate di 90° e specchiate rispetto all'orientamento "naturale":
  viene applicato un fix (rotate+flip) per riportarle dritte, altrimenti
  il modello imparerebbe lettere ruotate e in fase di inferenza sul tratto
  disegnato dall'utente le previsioni sarebbero sbagliate.
- I valori pixel in EMNIST sono già nella stessa convenzione di MNIST:
  0 = sfondo, valori alti = inchiostro. Dividendo per 255 si ottiene quindi
  direttamente "1 = tratto", come richiesto dal formato dell'app.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

# Da TF 2.16 in poi, tf.keras punta a Keras 3 di default. Il converter di
# tensorflowjs (--input_format=keras) si aspetta ancora il formato Keras
# "legacy" (tf-keras / Keras 2): senza questa variabile la conversione finale
# può fallire o produrre un model.json non compatibile con tf.loadLayersModel
# lato browser. Va impostata PRIMA di qualunque import di tensorflow.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import numpy as np

LETTERS = [chr(ord("A") + i) for i in range(26)]


def fix_emnist_orientation(images: np.ndarray) -> np.ndarray:
    """
    EMNIST (formato Matlab originale) salva le immagini ruotate di 90° e
    specchiate. Questo fix è lo standard riportato dalla community e dalla
    documentazione del dataset per riportarle nell'orientamento naturale
    di lettura.

    images: array shape (N, 28, 28) o (N, 28, 28, 1)
    """
    squeeze_back = False
    if images.ndim == 4:
        images = images[..., 0]
        squeeze_back = True

    # transpose degli assi riga/colonna -> corregge rotazione+specchiatura
    fixed = np.transpose(images, (0, 2, 1))

    if squeeze_back:
        fixed = fixed[..., np.newaxis]
    return fixed


def load_emnist_letters(quick_test: bool = False):
    """Scarica (se necessario) e carica EMNIST Letters via tensorflow-datasets."""
    import tensorflow_datasets as tfds

    print("Scaricamento / caricamento EMNIST Letters (tensorflow-datasets)...")
    ds_train, ds_test = tfds.load(
        "emnist/letters",
        split=["train", "test"],
        as_supervised=True,
        batch_size=-1,  # carica tutto in un unico batch -> array numpy
    )

    x_train, y_train = tfds.as_numpy(ds_train)
    x_test, y_test = tfds.as_numpy(ds_test)

    x_train = x_train.astype("float32")
    x_test = x_test.astype("float32")
    y_train = y_train.astype("int64")
    y_test = y_test.astype("int64")

    if quick_test:
        x_train, y_train = x_train[:4000], y_train[:4000]
        x_test, y_test = x_test[:1000], y_test[:1000]

    return (x_train, y_train), (x_test, y_test)


def preprocess(x_train, y_train, x_test, y_test):
    # Fix orientamento
    x_train = fix_emnist_orientation(x_train)
    x_test = fix_emnist_orientation(x_test)

    # Normalizza in [0,1]: 1 = inchiostro (vedi nota in testa al file)
    x_train = x_train / 255.0
    x_test = x_test / 255.0

    # EMNIST Letters usa etichette 1..26 -> riporta a 0..25
    y_train = y_train - 1
    y_test = y_test - 1

    assert y_train.min() >= 0 and y_train.max() <= 25, "Etichette fuori range!"
    assert x_train.shape[1:] == (28, 28, 1), f"Shape inattesa: {x_train.shape}"

    return x_train, y_train, x_test, y_test


def build_model():
    import tensorflow as tf
    from tensorflow.keras import layers, models

    model = models.Sequential(
        [
            layers.Input(shape=(28, 28, 1)),
            layers.Conv2D(32, 3, padding="same", activation="relu"),
            layers.BatchNormalization(),
            layers.Conv2D(32, 3, padding="same", activation="relu"),
            layers.MaxPooling2D(),
            layers.Dropout(0.25),

            layers.Conv2D(64, 3, padding="same", activation="relu"),
            layers.BatchNormalization(),
            layers.Conv2D(64, 3, padding="same", activation="relu"),
            layers.MaxPooling2D(),
            layers.Dropout(0.25),

            layers.Flatten(),
            layers.Dense(256, activation="relu"),
            layers.BatchNormalization(),
            layers.Dropout(0.4),
            layers.Dense(26),  # logits, niente softmax: coerente col README
        ]
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=["accuracy"],
    )
    return model


def make_augmenter():
    """Data augmentation leggera, utile perché EMNIST Letters ha scritture
    abbastanza pulite mentre l'input reale (Apple Pencil su iPad) avrà più
    variabilità di rotazione/spessore/posizione."""
    from tensorflow.keras.preprocessing.image import ImageDataGenerator

    return ImageDataGenerator(
        rotation_range=12,
        width_shift_range=0.08,
        height_shift_range=0.08,
        zoom_range=0.1,
        shear_range=8,
        fill_mode="constant",
        cval=0.0,
    )


def train(model, x_train, y_train, x_test, y_test, epochs, batch_size, use_augmentation):
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
        augmenter = make_augmenter()
        train_gen = augmenter.flow(x_train, y_train, batch_size=batch_size)
        history = model.fit(
            train_gen,
            steps_per_epoch=len(x_train) // batch_size,
            epochs=epochs,
            validation_data=(x_test, y_test),
            callbacks=callbacks,
        )
    else:
        history = model.fit(
            x_train,
            y_train,
            batch_size=batch_size,
            epochs=epochs,
            validation_data=(x_test, y_test),
            callbacks=callbacks,
        )

    return history


def evaluate_and_report(model, x_test, y_test):
    loss, acc = model.evaluate(x_test, y_test, verbose=0)
    print(f"\nAccuratezza finale sul test set: {acc * 100:.2f}%  (loss: {loss:.4f})")

    # Qualche esempio di predizione per sanity-check manuale
    import tensorflow as tf

    idx = np.random.choice(len(x_test), size=10, replace=False)
    logits = model.predict(x_test[idx], verbose=0)
    preds = np.argmax(logits, axis=1)
    print("\nEsempi di predizione (atteso -> predetto):")
    for i, pred in zip(idx, preds):
        atteso = LETTERS[y_test[i]]
        predetto = LETTERS[pred]
        flag = "OK" if atteso == predetto else "X "
        print(f"  [{flag}] {atteso} -> {predetto}")


def convert_to_tfjs(saved_model_path: str, out_dir: str):
    print(f"\nConversione in TensorFlow.js -> {out_dir}")
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        sys.executable,
        "-m",
        "tensorflowjs.converters.converter",
        "--input_format=keras",
        saved_model_path,
        out_dir,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
        raise RuntimeError(
            "tensorflowjs_converter ha fallito. Verifica che 'tensorflowjs' sia "
            "installato (pip install tensorflowjs) e che la versione sia "
            "compatibile con la tua versione di tensorflow."
        )
    print(result.stdout)
    print("Conversione completata.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--no-augmentation", action="store_true")
    parser.add_argument("--quick-test", action="store_true", help="Allena su un piccolo sottoinsieme, solo per testare la pipeline end-to-end")
    parser.add_argument(
        "--out",
        type=str,
        default=os.path.join("public", "models", "emnist"),
        help="Cartella di destinazione del modello TF.js (default: public/models/emnist)",
    )
    args = parser.parse_args()

    (x_train, y_train), (x_test, y_test) = load_emnist_letters(quick_test=args.quick_test)
    x_train, y_train, x_test, y_test = preprocess(x_train, y_train, x_test, y_test)

    print(f"Train: {x_train.shape}, Test: {x_test.shape}")

    model = build_model()
    model.summary()

    train(
        model,
        x_train,
        y_train,
        x_test,
        y_test,
        epochs=args.epochs,
        batch_size=args.batch_size,
        use_augmentation=not args.no_augmentation,
    )

    evaluate_and_report(model, x_test, y_test)

    with tempfile.TemporaryDirectory() as tmp_dir:
        keras_path = os.path.join(tmp_dir, "emnist_letters.h5")
        model.save(keras_path)
        print(f"\nModello Keras salvato temporaneamente in {keras_path}")

        convert_to_tfjs(keras_path, args.out)

    print("\nFatto. File generati:")
    for f in sorted(os.listdir(args.out)):
        full = os.path.join(args.out, f)
        size_kb = os.path.getsize(full) / 1024
        print(f"  {f}  ({size_kb:.1f} KB)")

    print(
        "\nAvvia 'npm run dev' e controlla nel pannello Stato input che compaia "
        "'Modello handwriting: pronto'."
    )


if __name__ == "__main__":
    main()