import ollama

print("1. Checking connection to Ollama...")

try:
    # Try a simple "Hello" to Llama 3
    response = ollama.chat(model='llama3', messages=[
        {'role': 'user', 'content': 'Say "AI is working" in one word.'},
    ])
    
    print("--------------------------------------------------")
    print("✅ SUCCESS! Ollama replied:")
    print(response['message']['content'])
    print("--------------------------------------------------")
    print("You can now run 'python app.py' and the AI features will work.")

except Exception as e:
    print("--------------------------------------------------")
    print("❌ FAILURE: Python cannot talk to Ollama.")
    print(f"Error details: {e}")
    print("--------------------------------------------------")
    print("TROUBLESHOOTING STEPS:")
    print("1. Is the Ollama app open in your taskbar?")
    print("2. Did you run 'ollama pull llama3' in a terminal?")
    print("3. Try running 'pip install ollama' again.")