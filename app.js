import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Enhanced MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/donationsDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Payment Schema improvements
const paymentSchema = new mongoose.Schema({
  customerId: String,
  name: { type: String, required: [true, 'Name is required'] },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  amount: { 
    type: Number, 
    required: [true, 'Amount is required'],
    min: [0.5, 'Amount must be at least $0.50']
  },
  currency: { type: String, default: 'usd' },
  status: { type: String, default: 'paid' },
  stripeSessionId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Donation', paymentSchema);

// Enhanced middleware
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Improved error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Webhook endpoint for Stripe events
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      await Payment.findOneAndUpdate(
        { stripeSessionId: session.id },
        {
          status: 'paid',
          customerId: session.customer,
          amount: session.amount_total / 100 // Convert cents to dollars
        },
        { new: true }
      );
    } catch (err) {
      console.error('Database update error:', err);
    }
  }

  res.json({ received: true });
});

// Fetch donations with pagination
app.get('/donations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get ONLY paid donations
    const [donors, totalDonors] = await Promise.all([
      Payment.find({ status: 'paid' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ status: 'paid' })
    ]);

    // Calculate total from paid donations only
    const totalResult = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { 
        _id: null, 
        total: { $sum: '$amount' } 
      }}
    ]);

    res.json({
      donors,          // List of paid donations
      total: totalResult[0]?.total || 0,  // Sum of paid amounts
      count: totalDonors,      // Total number of paid donations
      page,
      totalPages: Math.ceil(totalDonors / limit)
    });
  } catch (err) {
    console.error('Donations fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

// Create checkout session with validation
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, name, email } = req.body;
    
    // Validate input
    if (!amount || isNaN(amount) || amount < 0.5) {
      return res.status(400).json({ error: 'Invalid donation amount' });
    }
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Create preliminary database entry
    const paymentRecord = new Payment({
      name: name.trim(),
      email: email.trim(),
      amount: parseFloat(amount),
      stripeSessionId: '' // Temporary empty value
    });

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Donation' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email.trim(),
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        tempId: paymentRecord._id.toString()
      }
    });

    // Update payment record with session ID
    paymentRecord.stripeSessionId = session.id;
    await paymentRecord.save();

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});