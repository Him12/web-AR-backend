// backend/index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(bodyParser.json());

const port = process.env.PORT || 8080;

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// --- Get Menu by Restaurant ---
app.get("/api/menu/:restaurant_number", async (req, res) => {
    try {
        const { restaurant_number } = req.params;
        const { data, error } = await supabase
            .from("menu_items")
            .select("*")
            .eq("restaurant_number", restaurant_number);

        if (error) throw error;
        res.json({ success: true, menu: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Place Order ---
app.post("/api/order", async (req, res) => {
    try {
        const body = req.body || {};

        const orderPayload = {
            restaurant_number: body.restaurant_number || null,
            table_no: body.table_no || body.table_number || null, // ✅ match your DB column
            items: body.items || [],
            total: body.total || 0,
            payment_mode: body.payment_mode || 'cash',
            placed_at: new Date().toISOString(),
        };

        const { data, error } = await supabase.from("orders").insert([orderPayload]).select();

        if (error) throw error;
        res.json({ success: true, orderId: data[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Get orders (for a restaurant) ---
app.get("/api/orders", async (req, res) => {
    try {
        const restaurant_number = req.query.restaurant_number || req.query.restaurant || "";
        // Optional: allow filter by status
        const status = req.query.status || null;

        let q = supabase
            .from("orders")
            .select("*")
            .eq("restaurant_number", restaurant_number)
            .order("id", { ascending: false });

        if (status) q = q.eq("status", status);

        const { data, error } = await q;

        if (error) throw error;
        res.json({ success: true, orders: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: String(err) });
    }
});

// --- Update order status / other fields ---
app.patch("/api/orders/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const payload = req.body || {};

        // Only allow updating specific fields for safety
        const allowed = ["status", "payment_status", "table_no", "total"];
        const updateObj = {};
        allowed.forEach(k => {
            if (k in payload) updateObj[k] = payload[k];
        });

        if (Object.keys(updateObj).length === 0) {
            return res.status(400).json({ success: false, error: "No updatable fields provided" });
        }

        const { data, error } = await supabase
            .from("orders")
            .update(updateObj)
            .match({ id })
            .select();

        if (error) throw error;
        res.json({ success: true, order: data && data[0] ? data[0] : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: String(err) });
    }
});



app.listen(port, () => {
    console.log(`✅ Backend running on port ${port}`);
});
