const express = require('express');
const bodyParser = require('body-parser');
const { getLatestOtpsForEmails } = require('./imapService'); // Import the function from imapService.js
const { getToken } = require('./get_token'); // Import the new getToken function from get_token.js

const app = express();
const port = 3000;

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

  // Call the function to fetch OTPs for all emails
  getLatestOtpsForEmails(emails, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    return res.json(results); // Return the results (emails and OTPs)
  });
});

// API endpoint to get the token by email and password
app.post('/get-token', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    console.log(`Starting token retrieval process for email: ${email}`);
    
    // Call the getToken function from the get_token.js module
    const token = await getToken(email, password);

    // Return the token in the response
    return res.json({ token });

  } catch (err) {
    console.error('Error in get-token API:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
