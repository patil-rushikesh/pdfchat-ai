#!/usr/bin/env bash

set -e

EMBED_MODEL="nomic-embed-text"
LLM_MODEL="llama3.2:3b"

echo "==============================="
echo "Ollama Setup Script"
echo "==============================="

# --------------------------------
# Check Ollama installation
# --------------------------------
if ! command -v ollama &> /dev/null
then
    echo "❌ Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "✅ Ollama already installed"
fi


# --------------------------------
# Start Ollama service
# --------------------------------
if ! pgrep -x "ollama" > /dev/null
then
    echo "🚀 Starting Ollama..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
else
    echo "✅ Ollama already running"
fi


# --------------------------------
# Ensure embedding model
# --------------------------------
if ollama list | grep -q "$EMBED_MODEL"; then
    echo "✅ $EMBED_MODEL already installed"
else
    echo "⬇️ Pulling embedding model..."
    ollama pull "$EMBED_MODEL"
fi


# --------------------------------
# Ensure LLM model
# --------------------------------
if ollama list | grep -q "$LLM_MODEL"; then
    echo "✅ $LLM_MODEL already installed"
else
    echo "⬇️ Pulling LLM model..."
    ollama pull "$LLM_MODEL"
fi


# --------------------------------
# Verify Ollama API
# --------------------------------
echo "🔎 Checking Ollama API..."

if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama API running"
else
    echo "❌ Ollama API not reachable"
    exit 1
fi


# --------------------------------
# Test embedding model
# --------------------------------
echo "🧠 Testing embedding model..."

curl -s http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "test embedding"
}' > /dev/null

echo "✅ Embedding model working"

echo "==============================="
echo "🎉 Ollama setup complete"
echo "==============================="