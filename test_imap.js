var Imap = require('node-imap'),
    inspect = require('util').inspect;

var imap = new Imap({
  user: 'bull1@tourzy.us',
  password: 'Rtn@2024',
  host: 'imap.bizflycloud.vn',
  port: 993,
  tls: true
});

function openInbox(cb) {
  imap.openBox('INBOX', true, function(err, box) {
    if (err) {
      console.error('Error opening inbox:', err);
      return cb(err);
    }
    console.log('Inbox opened, messages count:', box.messages.total);
    cb(null, box);
  });
}

// Helper function to log more detailed error info
function logError(err, source) {
  console.error(`Error from ${source}:`, err);
  if (err.stack) {
    console.error('Stack trace:', err.stack);
  }
}

imap.once('error', function(err) {
  // Determine if the error is from the local machine or IMAP server
  if (err.code === 'ECONNREFUSED') {
    // Local machine error, unable to reach the server
    logError(err, 'Local machine (Connection refused)');
  } else if (err.code === 'ETIMEDOUT') {
    // Timeout error, could be network or server-side
    logError(err, 'Local machine (Timeout)');
  } else {
    // IMAP server error (authentication, protocol, etc.)
    logError(err, 'IMAP server');
  }

  // Retry connection if necessary (example for network-related issues)
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    console.log('Retrying connection...');
    imap.connect(); // Retry connection
  }

  imap.end(); // Close connection after error
});

imap.once('ready', function() {
  openInbox(function(err, box) {
    if (err) return;

    var fetchRange = `1:${Math.min(3, box.messages.total)}`;
    var f = imap.seq.fetch(fetchRange, {
      bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
      struct: true
    });

    f.on('message', function(msg, seqno) {
      console.log('Message #%d', seqno);
      var prefix = '(#' + seqno + ') ';
      
      msg.on('body', function(stream, info) {
        var buffer = '';
        stream.on('data', function(chunk) {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', function() {
          console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
        });
      });

      msg.once('attributes', function(attrs) {
        console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
      });

      msg.once('end', function() {
        console.log(prefix + 'Finished');
      });
    });

    f.once('error', function(err) {
      console.error('Fetch error: ' + err);
    });

    f.once('end', function() {
      console.log('Done fetching all messages!');
      imap.end(); // Close connection after fetching
    });
  });
});

imap.once('end', function() {
  console.log('Connection ended');
});

// Start the IMAP connection
imap.connect();
