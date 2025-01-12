const Imap = require('node-imap');
const ImapParser = require('imap').parseHeader;

// Extract OTP from the subject
function extractOtpFromSubject(subject) {
  const otpRegex = /- (\d{6,})/; // Looks for a 6-digit number after a hyphen
  const match = otpRegex.exec(subject);
  return match ? match[1] : null; // Return OTP or null if no OTP found
}

// Open the inbox
async function openInbox(imap) {
  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) reject('Unexpected error');
      resolve(box);
    });
  });
}

// Fetch the latest unseen OTP for a single email
async function getLatestOtpForEmail(imapConfig) {
  const imap = new Imap(imapConfig);
  
  const timeout = setTimeout(() => {
    imap.end();
  }, 30000); // Timeout after 30 seconds

  return new Promise((resolve, reject) => {
    imap.once('ready', async () => {
      try {
        const box = await openInbox(imap);
        
        // Check if the server supports the 'SORT' capability
        if (imap.serverSupports('SORT')) {
          // Sort messages by arrival time in reverse order (-ARRIVAL), and filter by 'UNSEEN' status
          imap.sort(['-ARRIVAL'], ['UNSEEN'], (err, results) => {
            if (err || !results.length) {
              clearTimeout(timeout);
              return resolve('No new messages');
            }

            // Fetch the most recent message (the first in the sorted list)
            const f = imap.fetch(results[0], {
              bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
              struct: true
            });

            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                let buffer = '';
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });

                stream.once('end', () => {
                  const header = ImapParser(buffer);
                  const otp = extractOtpFromSubject(header.subject[0]);
                  clearTimeout(timeout);
                  imap.end();

                  if (otp) {
                    return resolve(otp); // Return the OTP if found
                  } else {
                    return resolve('no otp'); // No OTP found
                  }
                });
              });
            });

            f.once('error', (err) => {
              clearTimeout(timeout);
              imap.end();
              reject('Unexpected error');
            });
          });
        } else {
          // Fallback if server doesn't support SORT
          imap.search(['UNSEEN', ['FROM', 'no-reply@web3auth.io']], (err, results) => {
            if (err || !results.length) {
              clearTimeout(timeout);
              return resolve('No unseen messages');
            }

            const f = imap.fetch(results[results.length - 1], {
              bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
              struct: true
            });

            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                let buffer = '';
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });

                stream.once('end', () => {
                  const header = ImapParser(buffer);
                  const otp = extractOtpFromSubject(header.subject[0]);
                  clearTimeout(timeout);
                  imap.end();

                  if (otp) {
                    return resolve(otp); // Return the OTP if found
                  } else {
                    return resolve('no otp'); // No OTP found
                  }
                });
              });
            });

            f.once('error', (err) => {
              clearTimeout(timeout);
              imap.end();
              reject('Unexpected error');
            });
          });
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    imap.once('error', (err) => {
      clearTimeout(timeout);
      reject('IMAP Error: ' + err);
    });

    imap.once('end', () => {
      // Do nothing once connection ends
    });

    imap.connect();
  });
}

async function getLatestOtpsForEmails(emails) {
  const results = {};

  // Iterate over each email object
  for (const { email: userEmail, password } of emails) {
    const domain = userEmail.split('@')[1];
    let host = '';
    
    // Determine the host based on the domain
    if (domain === 'veer.vn') {
      host = 'mail.veer.vn';
    } else if (domain === 'tourzy.us' || domain === 'dealhot.vn') {
      host = 'imap.bizflycloud.vn';
    } else {
      throw new Error('Unsupported email domain');
    }

    // IMAP configuration
    const imapConfig = {
      user: userEmail,
      password: password,
      host: host,
      port: 993,
      tls: true
    };

    try {
      // Get OTP for the current email
      const otp = await getLatestOtpForEmail(imapConfig);

      // Handle OTP response
      if (otp === 'no otp') {
        results[userEmail] = { error: 'no otp' };
      } else if (otp === 'timeout') {
        results[userEmail] = { error: 'timeout' };
      } else {
        results[userEmail] = { otp };
      }
    } catch (err) {
      // Catch any errors and log them
      results[userEmail] = { error: err.message || 'Unexpected error' };
    }
  }

  // Return the final results after processing all emails
  return results;
}


module.exports = {
  getLatestOtpsForEmails
};
