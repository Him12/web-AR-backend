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
    const body = req.body;
    const { data, error } = await supabase.from("orders").insert([body]).select();
    if (error) throw error;
    res.json({ success: true, orderId: data[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend running on port ${port}`);
});
