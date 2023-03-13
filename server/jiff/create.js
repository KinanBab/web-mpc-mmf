// Dependencies
const JIFFServer = require('../../jiff/lib/jiff-server.js');
const jiffServerBigNumber = require('../../jiff/lib/ext/jiff-server-bignumber.js');
const jiffServerRestAPI = require('../../jiff/lib/ext/jiff-server-restful.js');

const { config } = require('../config/config.js');
const mpc = require('../../client/app/helper/mpc.js');

const mailbox_hooks = require('./mailbox.js');
const authentication_hooks = require('./auth.js');

const MAX_SIZE = config.MAX_SIZE;

// Crypto hooks
const cryptoHooks =  {
  generateKeyPair: function () {
    return { public_key: 's1', secret_key: 's1' };
  },
  parseKey: function (jiff, key) {
    return key;
  },
  dumpKey: function (jiff, key) {
    return key;
  }
};

// Options and Hooks
const options = { logs: false, sodium: false, hooks: {} };
const computeOptions = {
  sodium: false,
  safemod: false,
  logs: true,
  Zp: '618970019642690137449562111',  // 2^89-1
  crypto_provider : "http://localhost:4321",
  hooks: {
    createSecretShare: [function (jiff, share) {
      share.refresh = function () {
        return share;
      };
      return share;
    }]
  }
};
options.hooks = Object.assign(options.hooks, mailbox_hooks, authentication_hooks, cryptoHooks);

// In particular, load session keys and public keys, and use initializeSession below
// to initialize the sessions.
function JIFFWrapper(server, app) {
  this.serverInstance = new JIFFServer(server, options);
  this.serverInstance.apply_extension(jiffServerBigNumber);
  this.serverInstance.apply_extension(jiffServerRestAPI, { app: app, maxBatchSize: Infinity });
  this.serverInstance._wrapper = this;
  this.serverInstance.mailbox_hooks = mailbox_hooks;

  // Unsupported/insecure operations
  this.serverInstance.request_number_share = function () {
    throw new Error('Generating numbers using the server is not supported!');
  };
  this.serverInstance.request_triplet_share = function () {
    throw new Error('Generating beaver triplets using the server is not supported!');
  };

  // Load some volatile state from DB that may have been lost on shutdown/startup.
  this.ready = this.loadVolatile();
}

// Add volatile state management
require('./volatile.js')(JIFFWrapper);
require('./tracker.js')(JIFFWrapper);

// Initializing a JIFF computation when a session is created.
JIFFWrapper.prototype.initializeSession = async function (session_key, public_key, password) {
  // Initialize
  var msg = { public_key: public_key, party_id: 1, party_count: MAX_SIZE, password: password };
  await this.serverInstance.handlers.initializeParty(session_key, 1, MAX_SIZE, msg);
};

JIFFWrapper.prototype.sendSharesToAnalyst = async function (session_key, party_id) {
  var self = this;
  var send = function(share) {
    return new Promise(function(resolve) {
      self.serverInstance.emit('share', share, session_key, 1, resolve);
    });
  };

  var shares = await mailbox_hooks.getAnalystShares(session_key, party_id);
  var promises = [];
  for (var i = 0; i < shares.length; i++) {
    promises.push(send(shares[i]));
  }

  await Promise.all(promises);
  console.log("Sent Analyst Shares for ", party_id);
};

// Setting up a listener for the session, to start computing when analyst requests.
JIFFWrapper.prototype.computeSession = async function (session_key) {
  console.log('Perform server side computation', session_key);

  var copy = Object.assign({}, computeOptions);
  copy.hooks = Object.assign({}, computeOptions.hooks, cryptoHooks);
  const computationInstance = this.serverInstance.compute(session_key, computeOptions);
  
  var self = this;
  // Wait for the analyst to tell us to compute.
  computationInstance.listen("compute", async function (party_id, msg) {
    console.log('Analyst indicates time to compute');

    // Reset the instance state as if it's fresh for every time the analyst
    // invokes compute.
    computationInstance.counters.reset();
    // Re-initializes the computation instace and re-reads its mailbox.
    computationInstance.socket.connect();

    // Send submitters ids to analyst
    var submitters = await self.getTrackerParties(session_key);
    computationInstance.emit('compute', [ 1 ], JSON.stringify(submitters), false);

    // Perform server-side MPC
    var table_template = require('../../client/app/' + config.client.table_template + '.js');
    var ordering = mpc.consistentOrdering(table_template);
    var functor = self.sendSharesToAnalyst.bind(self, session_key);
    await mpc.compute(computationInstance, submitters, ordering, table_template, null, functor);
  });
};

module.exports = JIFFWrapper;
