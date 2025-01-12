var Imap = require('imap'),
    inspect = require('util').inspect;

var imap = new Imap({
  user: 'bull1@veer.vn',
  password: 'Rtn@2024',
  host: 'mail.veer.vn',
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
      console.log('Fetch error: ' + err);
    });

    f.once('end', function() {
      console.log('Done fetching all messages!');
      imap.end();
    });
  });
});

imap.once('error', function(err) {
  console.error('IMAP error:', err);
});

imap.once('end', function() {
  console.log('Connection ended');
});

imap.connect();
