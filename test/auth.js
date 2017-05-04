const assert = require('assert');
const http = require('http');
const request = require('supertest');
const wedeployMiddleware = require('../');

let currentUser;

describe('wedeploy-middleware', () => {
  beforeEach(() => {
    currentUser = null;
  });

  describe('.auth()', function() {
    it('should export auth function', function() {
      assert(typeof wedeployMiddleware.auth, 'function');
    });

    it('should throws exception if configuration not specified', function() {
      assert.throws(() => {
        wedeployMiddleware.auth();
      }, Error);
    });

    it('should throws exception if authentication service url not specified', function() {
      assert.throws(() => {
        wedeployMiddleware.auth({});
      }, Error);
    });

    it('should not throw exception if authentication service url specified', function() {
      assert.doesNotThrow(() => {
        wedeployMiddleware.auth({url: ''});
      });
    });
  });

  describe('cookies', function() {
    it('should respond as authorized if token present in cookies', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set('Cookie', 'access_token=token')
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          server.close(() => done());
        });
    });

    it('should respond as authorized if token present in cookies with multiple values', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set('Cookie', 'foo=bar; access_token=token; access_token=wrong')
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          server.close(() => done());
        });
    });

    it('should respond as unauthorized if token not present in cookies', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server).get('/').set('Cookie', 'foo=bar').end((err, res) => {
        assert.strictEqual(401, res.statusCode);
        server.close(() => done());
      });
    });
  });

  describe('querystring', function() {
    it('should respond as authorized if token present in querystring', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server).get('/?access_token=token').end((err, res) => {
        assert.strictEqual(200, res.statusCode);
        server.close(() => done());
      });
    });
  });

  describe('headers', function() {
    it('should respond as authorized if token present in headers (Bearer)', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer token')
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          server.close(() => done());
        });
    });

    it('should respond as authorized if credentials are present in headers (Basic)', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set(
          'Authorization',
          `Basic ${Buffer.from('user:pass').toString('base64')}`
        )
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          assert.strictEqual('user', currentUser.email);
          server.close(() => done());
        });
    });

    it('should convert to lowercase value extracted from authorization header if it\'s an email (Basic)', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set(
          'Authorization',
          `Basic ${Buffer.from('USER@domain.com:pass').toString('base64')}`
        )
        .end((err, res) => {
          assert.strictEqual('user@domain.com', currentUser.email);
          server.close(() => done());
        });
    });

    it('should not convert to lowercase value extracted from authorization header if it\'s a token (Basic)', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set(
          'Authorization',
          `Basic ${Buffer.from('TOKEN:').toString('base64')}`
        )
        .end((err, res) => {
          assert.strictEqual('TOKEN', currentUser.token);
          server.close(() => done());
        });
    });

    it('should respond as authorized if unknown authorization scheme', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Unknown token')
        .end((err, res) => {
          assert.strictEqual(401, res.statusCode);
          server.close(() => done());
        });
    });

    it('should redirect if unauthorized', function(done) {
      let server = createServer('/login', true).listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer skipRedirectBecauseTokenWasMissing')
        .end((err, res) => {
          assert.strictEqual(302, res.statusCode);
          server.close(() => done());
        });
    });
  });

  describe('token presence', function() {
    it('should respond as unauthorized if token not present in headers, cookies or querystring', function(
      done
    ) {
      let server = createServer().listen(8888);
      request(server).get('/').end((err, res) => {
        assert.strictEqual(401, res.statusCode);
        server.close(() => done());
      });
    });

    it('should redirect if token not present in headers, cookies or querystring', function(
      done
    ) {
      let server = createServer('/login').listen(8888);
      request(server).get('/').end((err, res) => {
        assert.strictEqual(302, res.statusCode);
        server.close(() => done());
      });
    });
  });

  describe('scopes', function() {
    it('should redirect if scope is invalid', function(done) {
      let server = createServer('/login', false, ['invalidScope']).listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer skipRedirectBecauseTokenWasMissing')
        .end((err, res) => {
          assert.strictEqual(302, res.statusCode);
          server.close(() => done());
        });
    });

    it('should not redirect if scope is valid', function(done) {
      let server = createServer('/login', false, ['validScope']).listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer skipRedirectBecauseTokenWasMissing')
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          server.close(() => done());
        });
    });

    it('should not redirect if scope is not specified', function(done) {
      let server = createServer('/login').listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer skipRedirectBecauseTokenWasMissing')
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          server.close(() => done());
        });
    });

    it('should not authorize if scope is invalid', function(done) {
      let server = createServer(null, false, ['invalidScope']).listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer skipRedirectBecauseTokenWasMissing')
        .end((err, res) => {
          assert.strictEqual(401, res.statusCode);
          server.close(() => done());
        });
    });

    it('should authorize if scope is valid', function(done) {
      let server = createServer(null, false, ['validScope']).listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer skipRedirectBecauseTokenWasMissing')
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          server.close(() => done());
        });
    });

    it('should authorize if scope is not specified', function(done) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Bearer skipRedirectBecauseTokenWasMissing')
        .end((err, res) => {
          assert.strictEqual(200, res.statusCode);
          server.close(() => done());
        });
    });
  });

  describe('config.authorizationError', () => {
    it('should output default authorization error', function(done) {
      let server = createServer().listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Unknown token')
        .end((err, res) => {
          assert.deepEqual({status: 401, message: 'Unauthorized'}, res.body);
          server.close(() => done());
        });
    });

    it('should output custom authorization error', function(done) {
      let server = createServer(null, false, null, 'doNotEnter').listen(8888);
      request(server)
        .get('/')
        .set('Authorization', 'Unknown token')
        .end((err, res) => {
          assert.deepEqual('doNotEnter', res.body);
          server.close(() => done());
        });
    });
  });
});

function createServer(
  errorRedirectUrl = null,
  respondUserVerificationAsForbidden = false,
  scopes = null,
  authorizationError
) {
  return http.createServer(function(req, res) {
    switch (req.url) {
      case '/user':
        if (respondUserVerificationAsForbidden) {
          res.statusCode = 403;
          res.end();
        } else {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({token: 'token', supportedScopes: ['validScope']})
          );
        }
        break;
      default: {
        let config = {
          url: 'http://localhost:8888',
          redirect: errorRedirectUrl,
          scopes: scopes,
        };
        if (authorizationError) {
          config.authorizationError = authorizationError;
        }
        let authMiddleware = wedeployMiddleware.auth(config);
        authMiddleware(req, res, err => {
          currentUser = res.locals.auth.currentUser;
          res.end();
        });
      }
    }
  });
}
