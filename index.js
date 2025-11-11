// backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

// parse JSON bodies
app.use(express.json());

// CORS: allow FRONTEND_ORIGIN or fallback to "*"
const frontendOrigin = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: frontendOrigin }));

const port = process.env.PORT || 8080;

// Initialize Supabase client (service role key expected in env)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Simple health check
app.get("/health", (req, res) => res.json({ success: true, uptime: process.uptime() }));

// --- Get Menu by Restaurant (param) ---
app.get("/api/menu/:restaurant_number", async (req, res) => {
  try {
    const { restaurant_number } = req.params;
    if (!restaurant_number) return res.status(400).json({ success: false, error: "restaurant_number is required" });

    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_number", restaurant_number);

    if (error) throw error;
    return res.json({ success: true, menu: data || [] });
  } catch (err) {
    console.error("GET /api/menu/:restaurant_number error:", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// --- Place Order (used by frontend menu-api.placeOrder) ---
app.post("/api/order", async (req, res) => {
  try {
    const body = req.body || {};

    // minimal validation
    if (!body.restaurant_number) {
      return res.status(400).json({ success: false, error: "restaurant_number is required" });
    }

    const orderPayload = {
      restaurant_number: String(body.restaurant_number),
      table_no: body.table_no || body.table_number || null,
      items: body.items || [],
      total: body.total != null ? body.total : 0,
      payment_mode: body.payment_mode || "cash",
      payment_status: body.payment_status || "pending",
      status: body.status || "pending",
      created_at: new Date().toISOString(),
      placed_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from("orders").insert([orderPayload]).select();

    if (error) throw error;
    if (!data || !data[0]) throw new Error("Insert returned no data");

    return res.json({ success: true, orderId: data[0].id, order: data[0] });
  } catch (err) {
    console.error("POST /api/order error:", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// --- Get orders (query param style) ---
// GET /api/orders?restaurant_number=12345&status=pending
app.get("/api/orders", async (req, res) => {
  try {
    const restaurant_number = req.query.restaurant_number || req.query.restaurant || "";
    if (!restaurant_number) {
      return res.status(400).json({ success: false, error: "restaurant_number query param is required" });
    }

    const status = req.query.status || null;

    let q = supabase
      .from("orders")
      .select("*")
      .eq("restaurant_number", restaurant_number)
      .order("id", { ascending: false });

    if (status) q = q.eq("status", status);

    const { data, error } = await q;

    if (error) throw error;
    return res.json({ success: true, orders: data || [] });
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// --- Get orders (param style) ---
// GET /api/orders/:restaurant_number  (keeps backwards compatibility with code that expects this)
app.get("/api/orders/:restaurant_number", async (req, res) => {
  try {
    const { restaurant_number } = req.params;
    if (!restaurant_number) return res.status(400).json({ success: false, error: "restaurant_number is required" });

    const status = req.query.status || null;

    let q = supabase
      .from("orders")
      .select("*")
      .eq("restaurant_number", restaurant_number)
      .order("id", { ascending: false });

    if (status) q = q.eq("status", status);

    const { data, error } = await q;

    if (error) throw error;
    return res.json({ success: true, orders: data || [] });
  } catch (err) {
    console.error("GET /api/orders/:restaurant_number error:", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// --- Update order (patch specific fields) ---
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "invalid order id" });

    const payload = req.body || {};
    // whitelist fields that may be updated
    const allowed = ["status", "payment_status", "table_no", "total", "payment_mode"];
    const updateObj = {};
    allowed.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(payload, k)) updateObj[k] = payload[k];
    });

    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ success: false, error: "No updatable fields provided" });
    }

    updateObj.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("orders")
      .update(updateObj)
      .match({ id })
      .select();

    if (error) throw error;
    return res.json({ success: true, order: data && data[0] ? data[0] : null });
  } catch (err) {
    console.error("PATCH /api/orders/:id error:", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// Fallback for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

app.listen(port, () => {
  console.log(`✅ Backend running on port ${port}`);
});
