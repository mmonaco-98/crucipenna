#!/usr/bin/env bash
# setup_env.sh — crea il venv con Python 3.12 e installa le dipendenze per
# il training del modello EMNIST -> TFJS. Lancialo con: bash setup_env.sh

set -e  # esce subito se un comando fallisce, invece di proseguire silenziosamente

PYTHON_BIN=""

# Prova prima a chiedere a Homebrew dove l'ha installato (il modo piu' affidabile,
# funziona sia su Apple Silicon /opt/homebrew sia su Intel /usr/local)
if command -v brew >/dev/null 2>&1; then
    BREW_PREFIX="$(brew --prefix python@3.12 2>/dev/null || true)"
    if [ -n "$BREW_PREFIX" ] && [ -x "$BREW_PREFIX/bin/python3.12" ]; then
        PYTHON_BIN="$BREW_PREFIX/bin/python3.12"
    fi
fi

# Fallback: cerca un python3.12 qualsiasi nel PATH (es. installato con pyenv, ecc.)
if [ -z "$PYTHON_BIN" ] && command -v python3.12 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.12)"
fi

if [ -z "$PYTHON_BIN" ] || [ ! -x "$PYTHON_BIN" ]; then
    echo "ERRORE: non trovo un eseguibile python3.12."
    echo ""
    echo "Prova questi comandi e mandami l'output:"
    echo "  brew list python@3.12"
    echo "  brew --prefix python@3.12"
    echo "  find /opt/homebrew /usr/local -name 'python3.12' 2>/dev/null"
    exit 1
fi

echo "Uso Python: $PYTHON_BIN"
"$PYTHON_BIN" --version

echo "Rimuovo eventuale venv precedente..."
rm -rf venv

echo "Creo il venv con Python 3.12..."
"$PYTHON_BIN" -m venv venv

echo "Attivo il venv..."
source venv/bin/activate

echo "Verifico la versione di Python nel venv (deve essere 3.12.x):"
python --version

if ! python --version 2>&1 | grep -q "3.12"; then
    echo "ERRORE: il venv non sta usando Python 3.12. Interrompo."
    exit 1
fi

echo "Aggiorno pip..."
pip install --upgrade pip

echo "Installo le dipendenze (puo' richiedere qualche minuto)..."
pip install -r requirements.txt

echo ""
echo "==================================================================="
echo "Setup completato. Il venv e' attivo in questa shell."
echo "Ora puoi lanciare:  python train_emnist_model.py --quick-test"
echo ""
echo "ATTENZIONE: il venv resta attivo solo in QUESTA finestra di terminale"
echo "e solo finche' non la chiudi o lanci 'deactivate'. Se apri una nuova"
echo "finestra o scheda, devi riattivarlo con: source venv/bin/activate"
echo "==================================================================="