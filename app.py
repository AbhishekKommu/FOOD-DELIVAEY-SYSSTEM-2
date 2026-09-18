"""
FoodHub — A full-featured Food Delivery System
Backend: Flask + SQLite
Frontend: Vanilla HTML / CSS / JavaScript

Features:
  • User registration & login (password hashing, session tokens)
  • Menu CRUD (admin can create / read / update / delete dishes)
  • Cart management (add / remove / update quantity)
  • Order placement & order history
  • REST API returning JSON for every operation
  • Static folders for js / css / images
"""

import os
import sqlite3
import hashlib
import secrets
import json
from datetime import datetime
from functools import wraps

from flask import (
    Flask, request, jsonify, send_from_directory, session, g
)

# ---------------------------------------------------------------------------
#  App configuration
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "foodhub.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")

app = Flask(__name__, static_folder=STATIC_DIR, template_folder=TEMPLATE_DIR)
app.secret_key = secrets.token_hex(32)

DATABASE_SEED_FILE = os.path.join(BASE_DIR, "seed.json")

# ---------------------------------------------------------------------------
#  Database helpers
# ---------------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query_db(sql, args=(), one=False):
    cur = get_db().execute(sql, args)
    rows = cur.fetchall()
    cur.close()
    return (rows[0] if rows else None) if one else rows


def execute_db(sql, args=()):
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur.lastrowid


# ---------------------------------------------------------------------------
#  Password hashing (Werkzeug-style using hashlib + secrets)
# ---------------------------------------------------------------------------
def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"


def verify_password(password, stored):
    try:
        salt, hashed = stored.split("$", 1)
        return hashlib.sha256((salt + password).encode()).hexdigest() == hashed
    except (ValueError, AttributeError):
        return False


# ---------------------------------------------------------------------------
#  Auth decorator
# ---------------------------------------------------------------------------
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
#  Database initialisation
# ---------------------------------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT DEFAULT '',
            address TEXT DEFAULT '',
            is_admin INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            price REAL NOT NULL,
            category TEXT DEFAULT 'Main',
            image_url TEXT DEFAULT '',
            is_available INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            menu_item_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total REAL NOT NULL,
            status TEXT DEFAULT 'Pending',
            delivery_address TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            menu_item_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        )
    """)

    # Seed an admin account
    c.execute("SELECT id FROM users WHERE email = ?", ("admin@foodhub.com",))
    if not c.fetchone():
        c.execute(
            "INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)",
            ("Admin", "admin@foodhub.com", hash_password("admin123"))
        )

    # Seed menu items from seed.json
    if os.path.exists(DATABASE_SEED_FILE):
        with open(DATABASE_SEED_FILE) as f:
            items = json.load(f)
        for item in items:
            c.execute("SELECT id FROM menu_items WHERE name = ?", (item["name"],))
            if not c.fetchone():
                c.execute(
                    "INSERT INTO menu_items (name, description, price, category, image_url) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (item["name"], item["description"], item["price"],
                     item["category"], item["image_url"])
                )

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
#  Page routes (serve HTML templates)
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(TEMPLATE_DIR, "index.html")


@app.route("/login")
def login_page():
    return send_from_directory(TEMPLATE_DIR, "login.html")


@app.route("/register")
def register_page():
    return send_from_directory(TEMPLATE_DIR, "register.html")


@app.route("/menu")
def menu_page():
    return send_from_directory(TEMPLATE_DIR, "menu.html")


@app.route("/cart")
def cart_page():
    return send_from_directory(TEMPLATE_DIR, "cart.html")


@app.route("/orders")
def orders_page():
    return send_from_directory(TEMPLATE_DIR, "orders.html")


@app.route("/admin")
def admin_page():
    return send_from_directory(TEMPLATE_DIR, "admin.html")


# ---------------------------------------------------------------------------
#  REST API — Authentication
# ---------------------------------------------------------------------------
@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    existing = query_db("SELECT id FROM users WHERE email = ?", (email,), one=True)
    if existing:
        return jsonify({"error": "Email already registered"}), 409

    user_id = execute_db(
        "INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)",
        (name, email, hash_password(password), phone, address)
    )
    session["user_id"] = user_id
    session["is_admin"] = 0
    session["name"] = name
    return jsonify({"message": "Registration successful", "user": {
        "id": user_id, "name": name, "email": email, "is_admin": False
    }}), 201


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = query_db("SELECT * FROM users WHERE email = ?", (email,), one=True)
    if not user or not verify_password(password, user["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = user["id"]
    session["is_admin"] = user["is_admin"]
    session["name"] = user["name"]
    return jsonify({"message": "Login successful", "user": {
        "id": user["id"], "name": user["name"], "email": user["email"],
        "is_admin": bool(user["is_admin"]), "phone": user["phone"],
        "address": user["address"]
    }})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/me")
def api_me():
    if "user_id" not in session:
        return jsonify({"user": None})
    user = query_db("SELECT * FROM users WHERE id = ?", (session["user_id"],), one=True)
    if not user:
        session.clear()
        return jsonify({"user": None})
    return jsonify({"user": {
        "id": user["id"], "name": user["name"], "email": user["email"],
        "is_admin": bool(user["is_admin"]), "phone": user["phone"],
        "address": user["address"]
    }})


# ---------------------------------------------------------------------------
#  REST API — Menu (public read, admin write)
# ---------------------------------------------------------------------------
@app.route("/api/menu")
def api_menu_list():
    items = query_db("SELECT * FROM menu_items ORDER BY category, name")
    return jsonify([dict(r) for r in items])


@app.route("/api/menu/<int:item_id>")
def api_menu_item(item_id):
    item = query_db("SELECT * FROM menu_items WHERE id = ?", (item_id,), one=True)
    if not item:
        return jsonify({"error": "Menu item not found"}), 404
    return jsonify(dict(item))


@app.route("/api/menu", methods=["POST"])
@admin_required
def api_menu_create():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    price = data.get("price")
    category = (data.get("category") or "Main").strip()
    image_url = (data.get("image_url") or "").strip()

    if not name or price is None:
        return jsonify({"error": "Name and price are required"}), 400
    try:
        price = float(price)
    except (TypeError, ValueError):
        return jsonify({"error": "Price must be a number"}), 400

    item_id = execute_db(
        "INSERT INTO menu_items (name, description, price, category, image_url) "
        "VALUES (?, ?, ?, ?, ?)",
        (name, description, price, category, image_url)
    )
    return jsonify({"message": "Item created", "id": item_id}), 201


@app.route("/api/menu/<int:item_id>", methods=["PUT"])
@admin_required
def api_menu_update(item_id):
    data = request.get_json(silent=True) or {}
    item = query_db("SELECT * FROM menu_items WHERE id = ?", (item_id,), one=True)
    if not item:
        return jsonify({"error": "Menu item not found"}), 404

    name = (data.get("name") or item["name"]).strip()
    description = (data.get("description") or item["description"]).strip()
    price = data.get("price", item["price"])
    category = (data.get("category") or item["category"]).strip()
    image_url = (data.get("image_url") or item["image_url"]).strip()
    is_available = int(data.get("is_available", item["is_available"]))

    try:
        price = float(price)
    except (TypeError, ValueError):
        return jsonify({"error": "Price must be a number"}), 400

    execute_db(
        "UPDATE menu_items SET name=?, description=?, price=?, category=?, "
        "image_url=?, is_available=? WHERE id=?",
        (name, description, price, category, image_url, is_available, item_id)
    )
    return jsonify({"message": "Item updated"})


@app.route("/api/menu/<int:item_id>", methods=["DELETE"])
@admin_required
def api_menu_delete(item_id):
    item = query_db("SELECT * FROM menu_items WHERE id = ?", (item_id,), one=True)
    if not item:
        return jsonify({"error": "Menu item not found"}), 404
    execute_db("DELETE FROM menu_items WHERE id = ?", (item_id,))
    return jsonify({"message": "Item deleted"})


# ---------------------------------------------------------------------------
#  REST API — Cart
# ---------------------------------------------------------------------------
@app.route("/api/cart")
@login_required
def api_cart_list():
    rows = query_db(
        """SELECT c.id AS cart_id, c.quantity, m.* 
           FROM cart_items c JOIN menu_items m ON c.menu_item_id = m.id 
           WHERE c.user_id = ?""",
        (session["user_id"],)
    )
    return jsonify([dict(r) for r in rows])


@app.route("/api/cart", methods=["POST"])
@login_required
def api_cart_add():
    data = request.get_json(silent=True) or {}
    menu_item_id = data.get("menu_item_id")
    quantity = int(data.get("quantity", 1))
    if not menu_item_id or quantity < 1:
        return jsonify({"error": "Valid menu_item_id and quantity required"}), 400

    item = query_db("SELECT * FROM menu_items WHERE id = ?", (menu_item_id,), one=True)
    if not item:
        return jsonify({"error": "Menu item not found"}), 404

    existing = query_db(
        "SELECT * FROM cart_items WHERE user_id=? AND menu_item_id=?",
        (session["user_id"], menu_item_id), one=True
    )
    if existing:
        execute_db(
            "UPDATE cart_items SET quantity=? WHERE id=?",
            (existing["quantity"] + quantity, existing["id"])
        )
    else:
        execute_db(
            "INSERT INTO cart_items (user_id, menu_item_id, quantity) VALUES (?, ?, ?)",
            (session["user_id"], menu_item_id, quantity)
        )
    return jsonify({"message": "Added to cart"}), 201


@app.route("/api/cart/<int:cart_id>", methods=["PUT"])
@login_required
def api_cart_update(cart_id):
    data = request.get_json(silent=True) or {}
    quantity = int(data.get("quantity", 1))
    if quantity < 1:
        return jsonify({"error": "Quantity must be at least 1"}), 400

    ci = query_db(
        "SELECT * FROM cart_items WHERE id=? AND user_id=?",
        (cart_id, session["user_id"]), one=True
    )
    if not ci:
        return jsonify({"error": "Cart item not found"}), 404
    execute_db("UPDATE cart_items SET quantity=? WHERE id=?", (quantity, cart_id))
    return jsonify({"message": "Cart updated"})


@app.route("/api/cart/<int:cart_id>", methods=["DELETE"])
@login_required
def api_cart_delete(cart_id):
    ci = query_db(
        "SELECT * FROM cart_items WHERE id=? AND user_id=?",
        (cart_id, session["user_id"]), one=True
    )
    if not ci:
        return jsonify({"error": "Cart item not found"}), 404
    execute_db("DELETE FROM cart_items WHERE id=?", (cart_id,))
    return jsonify({"message": "Removed from cart"})


@app.route("/api/cart/clear", methods=["DELETE"])
@login_required
def api_cart_clear():
    execute_db("DELETE FROM cart_items WHERE user_id=?", (session["user_id"],))
    return jsonify({"message": "Cart cleared"})


# ---------------------------------------------------------------------------
#  REST API — Orders
# ---------------------------------------------------------------------------
@app.route("/api/orders", methods=["POST"])
@login_required
def api_order_create():
    data = request.get_json(silent=True) or {}
    delivery_address = (data.get("delivery_address") or "").strip()
    phone = (data.get("phone") or "").strip()

    cart = query_db(
        """SELECT c.*, m.name, m.price FROM cart_items c 
           JOIN menu_items m ON c.menu_item_id = m.id 
           WHERE c.user_id = ?""",
        (session["user_id"],)
    )
    if not cart:
        return jsonify({"error": "Cart is empty"}), 400

    total = sum(row["price"] * row["quantity"] for row in cart)
    order_id = execute_db(
        "INSERT INTO orders (user_id, total, status, delivery_address, phone) "
        "VALUES (?, ?, 'Pending', ?, ?)",
        (session["user_id"], total, delivery_address, phone)
    )
    for row in cart:
        execute_db(
            "INSERT INTO order_items (order_id, menu_item_id, name, price, quantity) "
            "VALUES (?, ?, ?, ?, ?)",
            (order_id, row["menu_item_id"], row["name"], row["price"], row["quantity"])
        )
    execute_db("DELETE FROM cart_items WHERE user_id=?", (session["user_id"],))

    return jsonify({"message": "Order placed", "order_id": order_id, "total": total}), 201


@app.route("/api/orders")
@login_required
def api_orders_list():
    if session.get("is_admin"):
        orders = query_db("SELECT * FROM orders ORDER BY created_at DESC")
    else:
        orders = query_db(
            "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC",
            (session["user_id"],)
        )
    result = []
    for o in orders:
        items = query_db("SELECT * FROM order_items WHERE order_id=?", (o["id"],))
        result.append({**dict(o), "items": [dict(i) for i in items]})
    return jsonify(result)


@app.route("/api/orders/<int:order_id>/status", methods=["PUT"])
@admin_required
def api_order_status(order_id):
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip()
    valid = ["Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"]
    if status not in valid:
        return jsonify({"error": f"Status must be one of {valid}"}), 400
    execute_db("UPDATE orders SET status=? WHERE id=?", (status, order_id))
    return jsonify({"message": "Status updated"})


# ---------------------------------------------------------------------------
#  REST API — Admin dashboard stats
# ---------------------------------------------------------------------------
@app.route("/api/admin/stats")
@admin_required
def api_admin_stats():
    menu_count = query_db("SELECT COUNT(*) AS c FROM menu_items", one=True)["c"]
    user_count = query_db("SELECT COUNT(*) AS c FROM users WHERE is_admin=0", one=True)["c"]
    order_count = query_db("SELECT COUNT(*) AS c FROM orders", one=True)["c"]
    revenue_row = query_db("SELECT COALESCE(SUM(total),0) AS r FROM orders WHERE status != 'Cancelled'", one=True)
    revenue = revenue_row["r"] if revenue_row else 0
    recent = query_db(
        """SELECT o.id, o.total, o.status, o.created_at, u.name AS customer
           FROM orders o JOIN users u ON o.user_id = u.id
           ORDER BY o.created_at DESC LIMIT 10"""
    )
    return jsonify({
        "menu_count": menu_count,
        "user_count": user_count,
        "order_count": order_count,
        "revenue": round(revenue, 2),
        "recent_orders": [dict(r) for r in recent]
    })


# ---------------------------------------------------------------------------
#  Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
