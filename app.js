const express = require('express');
const bodyParser = require('body-parser');
const { getLatestOtpsForEmails } = require('./imapService'); // Import the function from imapService.js
const { getTokenAndPubKey } = require('./get_token'); // Import the getPubKeyFromToken function

const app = express();
const port = 3000;

// Set a timeout for all routes (e.g., 30 seconds timeout)
const TIMEOUT_LIMIT = 300000; // 300 seconds timeout
app.use((req, res, next) => {
  req.setTimeout(TIMEOUT_LIMIT, () => { // 30 seconds timeout
    res.status(408).json({ error: 'Request Timeout' });
  });
  next();
});

// Use body-parser middleware to parse JSON bodies
app.use(bodyParser.json());

// API endpoint to get OTPs for multiple emails
app.post('/latest-otps', (req, res) => {
  const emails = req.body.emails;

  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: 'Emails array is required' });
  }

  // Ensure each email in the list contains email and password
  const invalidEmails = emails.filter(email => !email.email || !email.password);
  if (invalidEmails.length > 0) {
    return res.status(400).json({ error: 'Each email object must contain email and password' });
  }

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request Timeout')), TIMEOUT_LIMIT)
  );

  // Call the function to fetch OTPs with timeout handling
  Promise.race([getLatestOtpsForEmails(emails), timeoutPromise])
    .then(results => {
      return res.json(results); // Return the results (emails and OTPs)
    })
    .catch(err => {
      console.error('Error in /latest-otps API:', err);

      if (err.message === 'Request Timeout') {
        return res.status(408).json({ error: 'Request Timeout' });
      }

      return res.status(500).json({ error: err.message });
    });
});


// API endpoint to get both token and public key (pubKey)
app.post('/get-token-and-pubkey', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    console.log(`Starting token and public key retrieval process for email: ${email}`);

    // Creating a timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request Timeout')), TIMEOUT_LIMIT)
    );

    // Get the token and public key (pubKey) using the combined function
    const { token, pubKey } = await Promise.race([getTokenAndPubKey(email, password), timeoutPromise]);

    // Return both the token and pubKey in the response
    return res.json({ token, pubKey });

  } catch (err) {
    console.error('Error in get-token-and-pubkey API:', err);

    if (err.message === 'Request Timeout') {
      return res.status(408).json({ error: 'Request Timeout' });
    }

    return res.status(500).json({ error: err.message });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
