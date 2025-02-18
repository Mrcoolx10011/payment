app.get('/donations', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const [donors, totalDonors] = await Promise.all([
        Payment.find({ status: 'paid' })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Payment.countDocuments({ status: 'paid' })
      ]);
  
      const totalAmountResult = await Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { 
          _id: null, 
          total: { $sum: '$amount' } 
        }}
      ]);
  
      res.json({
        donors,
        total: totalAmountResult[0]?.total || 0,
        count: totalDonors,
        page,
        totalPages: Math.ceil(totalDonors / limit)
      });
    } catch (err) {
      console.error('Donations fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch donations' });
    }
  });