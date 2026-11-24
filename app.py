import os
import random
import sqlite3
import string
from datetime import datetime
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "station09.db")

TIERS = {
    "reguler": {"name": "Reguler — PS5 Slim", "rate": 20000, "unit": "jam"},
    "pro": {"name": "Pro OLED — PS5 Pro 120Hz", "rate": 35000, "unit": "jam"},
    "vip": {"name": "Ruang VIP Privat (Max 6 Org)", "rate": 85000, "unit": "jam"},
    "home": {"name": "Sewa Bawa Pulang (PS5 Slim)", "rate": 150000, "unit": "hari"},
}
EXTRA_STICK_PRICE = 15000


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            tier TEXT NOT NULL,
            display_spec TEXT NOT NULL,
            gear_spec TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'available'
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS promos (
            code TEXT PRIMARY KEY,
            discount_percent INTEGER NOT NULL,
            label TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_code TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            tier TEXT NOT NULL,
            tier_name TEXT NOT NULL,
            unit_code TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            duration INTEGER NOT NULL,
            duration_unit TEXT NOT NULL,
            extra_sticks INTEGER NOT NULL DEFAULT 0,
            promo_code TEXT,
            discount_amount INTEGER NOT NULL DEFAULT 0,
            total_price INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Terkonfirmasi',
            created_at TEXT NOT NULL
        )
    """)

    if cur.execute("SELECT COUNT(*) FROM units").fetchone()[0] == 0:
        seed_units = [
            ("REG-01", "Meja Reguler 01", "reguler", "TV 4K 43\" 60Hz HDR", "PS5 Slim • 2 DualSense", "available"),
            ("REG-02", "Meja Reguler 02", "reguler", "TV 4K 43\" 60Hz HDR", "PS5 Slim • 2 DualSense", "occupied"),
            ("REG-03", "Meja Reguler 03", "reguler", "TV 4K 43\" 60Hz HDR", "PS5 Slim • 2 DualSense", "available"),
            ("PRO-01", "Arena Pro 01", "pro", "LG C4 55\" OLED 120Hz", "PS5 Pro • DualSense Edge", "available"),
            ("PRO-02", "Arena Pro 02", "pro", "LG C4 55\" OLED 120Hz", "PS5 Pro • DualSense Edge", "occupied"),
            ("PRO-03", "Arena Pro 03", "pro", "LG C4 55\" OLED 120Hz", "PS5 Pro • LAN 1Gbps", "available"),
            ("VIP-01", "Ruang Privat A", "vip", "75\" Mini-LED 120Hz", "PS5 Pro + PS VR2 • Kedap Suara", "available"),
            ("VIP-02", "Ruang Privat B", "vip", "75\" Mini-LED 120Hz", "PS5 Pro • Dolby Atmos • Sofa", "available"),
        ]
        cur.executemany(
            "INSERT INTO units (code, name, tier, display_spec, gear_spec, status) VALUES (?, ?, ?, ?, ?, ?)",
            seed_units,
        )

    if cur.execute("SELECT COUNT(*) FROM promos").fetchone()[0] == 0:
        seed_promos = [
            ("MAIN15", 15, "Diskon 15% Reservasi Online", 1),
            ("MALAM20", 20, "Diskon 20% Sesi Malam / Akhir Pekan", 1),
            ("MABAR10", 10, "Diskon 10% Paket Mabar", 1),
        ]
        cur.executemany(
            "INSERT INTO promos (code, discount_percent, label, active) VALUES (?, ?, ?, ?)",
            seed_promos,
        )

    conn.commit()
    conn.close()


def make_booking_code():
    chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"S09-{chars}"


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/units", methods=["GET"])
def api_units():
    conn = get_db()
    rows = conn.execute("SELECT * FROM units ORDER BY id ASC").fetchall()
    conn.close()

    units = []
    for r in rows:
        t = TIERS.get(r["tier"], TIERS["reguler"])
        units.append({
            "code": r["code"],
            "name": r["name"],
            "tier": r["tier"],
            "rate": t["rate"],
            "display_spec": r["display_spec"],
            "gear_spec": r["gear_spec"],
            "status": r["status"],
        })

    available = sum(1 for u in units if u["status"] == "available")
    return jsonify({"units": units, "available": available, "total": len(units)})


@app.route("/api/promo/check", methods=["POST"])
def api_promo_check():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()

    if not code:
        return jsonify({"valid": False, "message": "Kode promo belum diisi."}), 400

    conn = get_db()
    row = conn.execute(
        "SELECT code, discount_percent, label FROM promos WHERE code = ? AND active = 1",
        (code,),
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"valid": False, "message": "Kode promo tidak valid atau sudah berakhir."}), 404

    return jsonify({
        "valid": True,
        "code": row["code"],
        "discount_percent": row["discount_percent"],
        "label": row["label"],
    })


@app.route("/api/bookings", methods=["POST"])
def api_create_booking():
    data = request.get_json(silent=True) or {}

    name = (data.get("customer_name") or "").strip()
    phone = (data.get("customer_phone") or "").strip()
    tier = (data.get("tier") or "").strip().lower()
    unit_code = (data.get("unit_code") or "AUTO").strip().upper()
    booking_date = (data.get("booking_date") or "").strip()
    start_time = (data.get("start_time") or "").strip()
    promo_code = (data.get("promo_code") or "").strip().upper()

    try:
        duration = int(data.get("duration", 1))
        extra_sticks = int(data.get("extra_sticks", 0))
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Format durasi atau stik tidak valid."}), 400

    if not name or not phone or not booking_date or not start_time:
        return jsonify({"success": False, "message": "Lengkapi nama, WhatsApp, tanggal, dan jam mulai."}), 400

    if tier not in TIERS:
        return jsonify({"success": False, "message": "Kategori paket tidak dikenali."}), 400

    if not (1 <= duration <= 14) or not (0 <= extra_sticks <= 4):
        return jsonify({"success": False, "message": "Nilai durasi (1–14) atau stik (0–4) di luar batas."}), 400

    tier_info = TIERS[tier]
    base_price = tier_info["rate"] * duration
    sticks_price = extra_sticks * EXTRA_STICK_PRICE
    subtotal = base_price + sticks_price

    conn = get_db()
    cur = conn.cursor()

    discount_percent = 0
    valid_promo = None
    if promo_code:
        p = cur.execute(
            "SELECT code, discount_percent FROM promos WHERE code = ? AND active = 1",
            (promo_code,),
        ).fetchone()
        if p:
            discount_percent = p["discount_percent"]
            valid_promo = p["code"]

    discount_amount = round(subtotal * (discount_percent / 100))
    total_price = subtotal - discount_amount
    booking_code = make_booking_code()
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    final_unit = "ANTAR-RUMAH" if tier == "home" else unit_code

    today_str = datetime.now().strftime("%Y-%m-%d")
    if tier != "home" and final_unit != "AUTO" and booking_date == today_str:
        cur.execute(
            "UPDATE units SET status = 'reserved' WHERE code = ? AND status = 'available'",
            (final_unit,),
        )

    cur.execute("""
        INSERT INTO bookings (
            booking_code, customer_name, customer_phone, tier, tier_name,
            unit_code, booking_date, start_time, duration, duration_unit,
            extra_sticks, promo_code, discount_amount, total_price, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        booking_code, name, phone, tier, tier_info["name"],
        final_unit, booking_date, start_time, duration, tier_info["unit"],
        extra_sticks, valid_promo, discount_amount, total_price, created_at
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "booking": {
            "booking_code": booking_code,
            "customer_name": name,
            "tier_name": tier_info["name"],
            "unit_code": "Kurir Antar ke Rumah" if tier == "home" else final_unit,
            "booking_date": booking_date,
            "start_time": start_time,
            "duration": duration,
            "duration_unit": tier_info["unit"],
            "extra_sticks": extra_sticks,
            "promo_code": valid_promo,
            "discount_amount": discount_amount,
            "total_price": total_price,
            "status": "Terkonfirmasi",
        }
    }), 201


@app.route("/api/bookings/<booking_code>", methods=["GET"])
def api_lookup_booking(booking_code):
    code = booking_code.strip().upper()
    conn = get_db()
    row = conn.execute("SELECT * FROM bookings WHERE booking_code = ?", (code,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"found": False, "message": f"Kode booking {code} tidak ditemukan."}), 404

    return jsonify({"found": True, "booking": dict(row)})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="127.0.0.1", port=5000)