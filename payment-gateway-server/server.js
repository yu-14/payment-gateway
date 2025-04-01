const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

const DB_FILE = path.join(__dirname, 'transactions.json');
const MAX_AMOUNT = 100000;

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

let transactions = loadTransactions();

function loadTransactions() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error loading transactions:', err);
  }
  return [];
}

function saveTransactions() {
  fs.writeFile(DB_FILE, JSON.stringify(transactions, null, 2), (err) => {
    if (err) {
      console.error('Error saving transactions:', err);
    }
  });
}

app.post('/api/pay', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ 
        error: "Invalid amount",
        details: "Please provide a valid numeric amount"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
        details: "Amount must be greater than zero"
      });
    }

    if (amount > MAX_AMOUNT) {
      return res.status(400).json({
        error: "Amount limit exceeded",
        details: `Maximum allowed amount is ${MAX_AMOUNT}`
      });
    }

    const newTransaction = {
      id: `TXN${Date.now()}`,
      amount: parseFloat(amount.toFixed(2)), // Ensure 2 decimal places
      status: 'success',
      timestamp: new Date().toISOString(),
      merchant: 'JUSPAY_MOCK',
      payment_method: req.body.method || '1-click',
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    };

    transactions.unshift(newTransaction);
    saveTransactions();

    res.json({
      ...newTransaction,
      message: 'Payment processed successfully',
      success: true
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ 
      error: "Payment processing failed",
      details: error.message 
    });
  }
});

app.get('/api/transactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = transactions.slice(offset, offset + limit);
    
    res.json({
      data: result,
      total: transactions.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Transaction data stored in ${DB_FILE}`);
});

process.on('SIGTERM', () => {
  console.log('Saving transactions before shutdown...');
  saveTransactions();
  process.exit(0);
});