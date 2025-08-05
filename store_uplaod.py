
import json
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
cred = credentials.Certificate("firebase_config.json")  # Your Admin SDK JSON
firebase_admin.initialize_app(cred)
db = firestore.client()

# JSON files to upload
files = ["store_database/buyme_stores.json"]

# Upload process
for file_path in files:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        brand = data.get("brand_name", "unknown")

        for store in data["stores"]:
            # Prepare full store data (preserve all fields, even if null)
            store_data = {
                "brand": brand,
                "name_en": store.get("name_en"),
                "name_he": store.get("name_he"),
                "logo": store.get("logo"),
                "store_url": store.get("store_url"),
                "category": store.get("category")
            }

            # Skip only if both names are missing (completely invalid store)
            if not store_data["name_en"] and not store_data["name_he"]:
                continue

            # Upload as a new document (auto-ID)
            db.collection("stores").add(store_data)

print("Stores uploaded successfully with all fields preserved!")
