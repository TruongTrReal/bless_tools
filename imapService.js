const Imap = require('node-imap');
const ImapParser = require('imap').parseHeader;

// Extract OTP from the subject
function extractOtpFromSubject(subject) {
  const otpRegex = /- (\d{6,})/; // Looks for a 6-digit number after a hyphen
  const match = otpRegex.exec(subject);
  if (match) {
    return match[1]; // Return OTP
  }
  return null; // No OTP found
}

// Open the inbox
function openInbox(imap, cb) {
  imap.openBox('INBOX', false, cb); // `false` means we want to read and modify emails
}

// Function to fetch the latest unseen OTP for a single email
function getLatestOtpForEmail(imapConfig, cb) {
  const imap = new Imap(imapConfig);
  const timeout = setTimeout(() => {
    imap.end();
    return cb(null, 'timeout');
  }, 30000); // Timeout after 30 seconds

  imap.once('ready', function() {
    openInbox(imap, function(err, box) {
      if (err) {
        clearTimeout(timeout);
        return cb('unexpected error');
      }

      // Check if the server supports the 'SORT' capability
      if (imap.serverSupports('SORT')) {
        // Sort messages by arrival time in reverse order (-ARRIVAL), and filter by 'UNSEEN' status
        imap.sort([ '-ARRIVAL' ], [ 'UNSEEN' ], function(err, results) {
          if (err || !results.length) {
            clearTimeout(timeout);
            return cb('No new messages');
          }

          // Fetch the most recent message (the first in the sorted list)
          const f = imap.fetch(results[0], {
            bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
            struct: true
          });

          f.on('message', function(msg, seqno) {
            msg.on('body', function(stream, info) {
              let buffer = '';
              stream.on('data', function(chunk) {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', function() {
                // Parse the email header
                const header = ImapParser(buffer);
                const otp = extractOtpFromSubject(header.subject[0]);
                if (otp) {
                  clearTimeout(timeout); // Clear timeout when OTP is found
                  imap.end(); // Close connection after finding OTP
                  return cb(null, otp); // Return the OTP
                } else {
                  clearTimeout(timeout);
                  imap.end();
                  return cb(null, 'no otp'); // No OTP found
                }
              });
            });
          });

          f.once('error', function(err) {
            clearTimeout(timeout);
            imap.end();
            return cb('unexpected error');
          });

          f.once('end', function() {
            // Do nothing once fetching is complete
          });
        });
      } else {
        // Fallback if server doesn't support SORT
        imap.search(['UNSEEN', ['FROM', 'no-reply@web3auth.io']], function(err, results) {
          if (err || !results.length) {
            clearTimeout(timeout);
            return cb('No unseen messages');
          }

          const f = imap.fetch(results[results.length - 1], {
            bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
            struct: true
          });

          f.on('message', function(msg, seqno) {
            msg.on('body', function(stream, info) {
              let buffer = '';
              stream.on('data', function(chunk) {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', function() {
                const header = ImapParser(buffer);
                const otp = extractOtpFromSubject(header.subject[0]);
                if (otp) {
                  clearTimeout(timeout); // Clear timeout when OTP is found
                  imap.end(); // Close connection after finding OTP
                  return cb(null, otp); // Return the OTP
                } else {
                  clearTimeout(timeout);
                  imap.end();
                  return cb(null, 'no otp'); // No OTP found
                }
              });
            });
          });
        });
      }
    });
  });

  imap.once('error', function(err) {
    clearTimeout(timeout);
    console.log('IMAP Error: ' + err);
    cb('unexpected error');
  });

  imap.once('end', function() {
    // No further actions once connection ends
  });

  imap.connect();
}

// Function to handle multiple emails and fetch OTPs
function getLatestOtpsForEmails(emails, cb) {
  let results = {};
  let remainingEmails = emails.length;

  emails.forEach((email) => {
    const { email: userEmail, password } = email;

    const imapConfig = {
      user: userEmail,
      password: password,
      host: 'mail.veer.vn',
      port: 993,
      tls: true
    };

    getLatestOtpForEmail(imapConfig, (err, otp) => {
      remainingEmails--;

      if (err) {
        results[userEmail] = { error: err };
      } else {
        if (otp === 'no otp') {
          results[userEmail] = { error: 'no otp' };
        } else if (otp === 'timeout') {
          results[userEmail] = { error: 'timeout' };
        } else {
          results[userEmail] = { otp };
        }
      }

      if (remainingEmails === 0) {
        return cb(null, results); // Return all results once all emails are processed
      }
    });
  });
}

module.exports = {
  getLatestOtpsForEmails
};
