import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import axios from "axios";
import "./App.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

function App() {
  const [donors, setDonors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [donationAmount, setDonationAmount] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDonations();
  }, []);

 // Update the fetchDonations function
const fetchDonations = async () => {
  try {
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/donations`
    );
    console.log('API Response:', response.data); // Debug log
    
    // Ensure we're using the correct data structure
    setDonors(response.data.donors || []);
    setTotal(response.data.total || 0);
  } catch (error) {
    console.error("Error fetching donations:", error);
    setError("Failed to load donations. Please try again later.");
  }
};

  const [donorName, setDonorName] = useState("");
const [donorEmail, setDonorEmail] = useState("");

const handleDonate = async () => {
  setLoading(true);
  setError("");

  const amount = parseFloat(donationAmount);
  if (isNaN(amount) || amount < 1) {
    setError("Please enter a valid amount (minimum $1)");
    setLoading(false);
    return;
  }
  if (!donorName.trim() || !donorEmail.trim()) {
    setError("Name and email are required.");
    setLoading(false);
    return;
  }

  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/create-checkout-session`,
      { amount, name: donorName, email: donorEmail }
    );

    const stripe = await stripePromise;
    const { error } = await stripe.redirectToCheckout({
      sessionId: response.data.sessionId,
    });

    if (error) throw error;

    setTimeout(fetchDonations, 3000);
  } catch (error) {
    console.error("Payment Error:", error);
    setError(error.response?.data?.error || "Payment failed. Try again.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="App">
      <h1>Support Our Cause</h1>

      <div className="donation-form">
  <input
    type="text"
    placeholder="Your Name"
    value={donorName}
    onChange={(e) => setDonorName(e.target.value)}
    disabled={loading}
  />
  <input
    type="email"
    placeholder="Your Email"
    value={donorEmail}
    onChange={(e) => setDonorEmail(e.target.value)}
    disabled={loading}
  />
  <input
    type="number"
    min="1"
    step="0.01"
    placeholder="Enter amount ($)"
    value={donationAmount}
    onChange={(e) => setDonationAmount(e.target.value)}
    disabled={loading}
  />
  <button
    onClick={handleDonate}
    disabled={loading || !donationAmount}
    className="donate-btn"
  >
    {loading ? "Processing..." : "Donate Now"}
  </button>
  // In your App.js render method
<div className="donation-stats">
  <h2>Total Raised: ${total.toFixed(2)}</h2>
  <h3>Recent Donors ({donors.length}):</h3>
  
  {donors.length > 0 ? (
    donors.map((donor) => (
      <div key={donor._id} className="donor-card">
        <div className="donor-info">
          <span className="donor-name">{donor.name}</span>
          <span className="donation-date">
            {new Date(donor.createdAt).toLocaleDateString()}
          </span>
        </div>
        <span className="donor-amount">
          ${donor.amount.toFixed(2)}
        </span>
      </div>
    ))
  ) : (
    <p className="no-donations">No donations yet. Be the first!</p>
  )}
</div>
</div>
    </div>
  );
}

export default App;