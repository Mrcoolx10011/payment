import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [donors, setDonors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [donationAmount, setDonationAmount] = useState("");

  useEffect(() => {
    fetchDonations();
  }, []);

  const fetchDonations = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/donations`);
      setDonors(response.data.donors || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Error fetching donations:", error.response?.data || error.message);
    }
  };

  const handleDonate = async () => {
    setLoading(true);

    const amount = parseInt(donationAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid donation amount.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/create-checkout-session`, {
        amount,
      });

      console.log("Checkout Session Response:", response.data); // Debugging

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        alert("Payment session creation failed.");
      }
    } catch (error) {
      console.error("Payment Error:", error.response?.data || error.message);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Support Our Cause</h1>

      <input
        type="number"
        placeholder="Enter donation amount"
        value={donationAmount}
        onChange={(e) => setDonationAmount(e.target.value)}
      />
      <button onClick={handleDonate} disabled={loading} className="donate-btn">
        {loading ? "Processing..." : "Donate Now"}
      </button>

      <h2>Total Raised: ${total}</h2>

      <div className="donors-list">
        <h3>Recent Donors:</h3>
        {donors.length > 0 ? (
          donors.map((donor, index) => (
            <div key={index} className="donor-card">
              <p>{donor.name}</p>
              <p>{donor.email}</p>
              <p>${donor.amount}</p>
            </div>
          ))
        ) : (
          <p>No donations yet.</p>
        )}
      </div>
    </div>
  );
}

export default App;
