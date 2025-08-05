from flask import Flask, render_template, request, redirect, session, url_for, jsonify
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
import os
import random
import string


# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.urandom(24)

# Initialize Firebase
cred = credentials.Certificate("firebase_config.json")  # Admin SDK JSON
firebase_admin.initialize_app(cred)
db = firestore.client()

# ---------------------------
# Helper Functions
# ---------------------------
def get_personal_cards(email):
    cards_ref = db.collection("giftcards").document(email).collection("cards")
    cards = []
    for doc in cards_ref.stream():
        card = doc.to_dict()
        card["id"] = doc.id
        cards.append(card)
    return cards

def get_group_cards(group_id):
    cards_ref = db.collection("giftcards").document(group_id).collection("cards")
    cards = []
    for doc in cards_ref.stream():
        card = doc.to_dict()
        card["id"] = doc.id
        cards.append(card)
    return cards

def generate_group_id():
    return "family-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6)) 

def get_brands():
    stores_ref = db.collection("stores").stream()
    brands = set()
    for doc in stores_ref:
        data = doc.to_dict()
        if data.get("brand"):
            brands.add(data["brand"])
    return sorted(brands)

def get_brands_from_cards(cards):
    brands = set()
    for card in cards:
        if "brand" in card and card["brand"]:
            brands.add(card["brand"])
    return list(brands)



# ---------------------------
# Routes
# ---------------------------

@app.route("/")
def home():
    return render_template("login.html")

# Handle login (Google Sign-In)
@app.route("/login", methods=["POST"])
def login():
    id_token = request.json.get("id_token")
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        email = decoded_token["email"]
        session["email"] = email

        # Check if user exists
        user_ref = db.collection("users").document(email)
        user_doc = user_ref.get()

        if user_doc.exists:
            session["group_id"] = user_doc.to_dict().get("group_id")
        else:
            session["group_id"] = None  # start personal only
            user_ref.set({"group_id": None})

        return "", 204
    except Exception as e:
        print("Auth error:", e)
        return "Unauthorized", 401

# Dashboard - show gift cards
@app.route("/dashboard")
def dashboard():
    if "email" not in session:
        return redirect(url_for("home"))

    email = session["email"]
    user_doc = db.collection("users").document(email).get()

    group_id = None
    group_owner = None
    group_cards = []
    personal_cards = get_personal_cards(email)

    # Check if user has group
    if user_doc.exists:
        group_id = user_doc.to_dict().get("group_id")

    # Fetch group cards and owner
    if group_id:
        group_cards = get_group_cards(group_id)
        group_ref = db.collection("groups").document(group_id).get()
        if group_ref.exists:
            group_owner = group_ref.to_dict().get("owner")

    # --- NEW: Merge all cards and get their brands ---
    all_cards = personal_cards + group_cards
    brands = get_brands_from_cards(all_cards)

    # --- NEW: Fetch matching stores from Firestore ---
    stores = []
    if brands:  # only query if we have brands
        stores_query = db.collection("stores").where("brand", "in", brands)
        for doc in stores_query.stream():
            stores.append(doc.to_dict())

    # Pass `stores` to template for fuzzy search suggestions
    return render_template(
        "dashboard.html",
        personal_cards=personal_cards,
        group_cards=group_cards,
        group_owner=group_owner,
        group_id=group_id,
        stores=stores
    )


# Add new card
@app.route("/add_card", methods=["GET", "POST"])
def add_card():
    if "email" not in session:
        return redirect(url_for("home"))

    group_id = session.get("group_id")

    if request.method == "POST":
        target = request.form.get("target")

        card_data = {
            "brand": request.form.get("brand", ""),
            "store": request.form.get("store", ""),
            "number": request.form["number"],
            "cvv": request.form.get("cvv", ""),
            "balance": request.form.get("balance", ""),
            "expiry": request.form.get("expiry", ""),
            "notes": request.form.get("notes", ""),
            "shared": False
        }

        if target == "group" and group_id:
            db.collection("giftcards").document(group_id).collection("cards").add(card_data)
        else:
            db.collection("giftcards").document(session["email"]).collection("cards").add(card_data)

        return redirect(url_for("dashboard"))

    # Fetch brands (unique list)
    brands = get_brands()

    # Fetch all stores (for initial population)
    stores = [doc.to_dict() for doc in db.collection("stores").stream()]

    return render_template(
        "add_card.html",
        group_id=group_id,
        brands=brands,
        stores=stores,
        card=None,
        edit_mode=False
    )

# Edit card (AJAX)
@app.route("/edit_card/<target>/<card_id>", methods=["PUT"])
def edit_card(target, card_id):
    if "email" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    ref_path = session["group_id"] if target == "group" else session["email"]

    data = request.json
    db.collection("giftcards").document(ref_path).collection("cards").document(card_id).update(data)

    return jsonify(data)

# Delete card (AJAX)
@app.route("/delete_card/<target>/<card_id>", methods=["DELETE"])
def delete_card(target, card_id):
    if "email" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    ref_path = session["group_id"] if target == "group" else session["email"]

    db.collection("giftcards").document(ref_path).collection("cards").document(card_id).delete()

    return jsonify({"success": True})

# Logout
@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

# Create group
@app.route("/create_group", methods=["POST"])
def create_group():
    if "email" not in session:
        return redirect(url_for("home"))

    # Generate group_id
    group_id = generate_group_id()

    # Create group document
    db.collection("groups").document(group_id).set({
        "owner": session["email"],
        "members": [session["email"]]
    })

    # Link user to group
    db.collection("users").document(session["email"]).set({"group_id": group_id})
    session["group_id"] = group_id

    return redirect(url_for("dashboard"))


# Invite member to group
@app.route("/invite_member", methods=["POST"])
def invite_member():
    if "email" not in session:
        return redirect(url_for("home"))

    group_id = session.get("group_id")
    if not group_id:
        return "No group", 400

    # Check owner
    group_ref = db.collection("groups").document(group_id)
    group_data = group_ref.get().to_dict()
    if group_data["owner"] != session["email"]:
        return "Only owner can invite", 403

    invite_email = request.form["invite_email"]

    # Add to group members
    group_ref.update({
        "members": firestore.ArrayUnion([invite_email])
    })

    # Link invited user to group
    db.collection("users").document(invite_email).set({"group_id": group_id})

    return redirect(url_for("dashboard"))

# ---------------------------
# Run Flask
# ---------------------------
if __name__ == "__main__":
    app.run(debug=True)
