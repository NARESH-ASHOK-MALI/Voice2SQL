# File: nlp_service/list_models.py

import os
import google.generativeai as genai
from dotenv import load_dotenv

print("--- Listing available Google AI Models ---")

if not load_dotenv():
    print("\n[FAILURE] Could not find the .env file in the 'nlp_service' folder.")
else:
    api_key = os.getenv("GOOGLE_API_KEY")

    if not api_key:
        print("\n[FAILURE] GOOGLE_API_KEY not found in the .env file.")
    else:
        try:
            genai.configure(api_key=api_key)
            
            print("\nFound the following models that support our task:")
            print("---------------------------------------------")
            
            found_model = False
            for m in genai.list_models():
                # We need a model that can generate text from a prompt
                if 'generateContent' in m.supported_generation_methods:
                    # The name we need for LangChain is the part after "models/"
                    model_name_for_langchain = m.name.replace("models/", "")
                    print(f"Full Name: {m.name}  >>  (Use in code: '{model_name_for_langchain}')")
                    found_model = True

            if not found_model:
                print("No suitable models found for your API key in this region.")
            
            print("---------------------------------------------")

        except Exception as e:
            print(f"\n[FAILURE] An error occurred: {e}")