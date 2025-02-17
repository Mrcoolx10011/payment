import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import Stripe from 'stripe';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// ✅ Connect to Local MongoDB (without URL)
mongoose.connect('mongodb://127.0.0.1:27017/donationsDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected (Local)"))
  .catch(err => console.error("❌ MongoDB Connection Failed:", err));

// ✅ Donation Schema
const donationSchema = new mongoose.Schema({
  name: String,
  email: String,
  amount: Number,
  createdAt: { type: Date, default: Date.now }
});

const Donation = mongoose.model("Donation", donationSchema);


// ✅ Create Stripe Checkout Session
app.post("/create-checkout-session", async (req, res) => {
  const { amount, name, email } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid donation amount" });
  }

  try {
    console.log("Creating Stripe checkout session with:", { amount, name, email });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Donation',
            },
            unit_amount: amount * 100, // Stripe expects the amount in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        name,
        email,
      },
    });

    console.log("Stripe checkout session created:", session);
    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creating Stripe checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});
// ✅ Get All Donations
app.get("/donations", async (req, res) => {
  try {
    const donations = await Donation.find();
    res.json(donations);
  } catch (error) {
    console.error("❌ Error fetching donations:", error);
    res.status(500).json({ error: "Failed to fetch donations" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));