const jwt = require('jsonwebtoken');

function requireAuthorization(req, res, next) {
  // Verifies token
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    req.decodedToken = decodedToken;
    return next();
  } catch (e) {
    const unauthorized = new Error(
      'You need to authenticate before accessing this resource.'
    );
    unauthorized.status = 401;
    unauthorized.title = 'Unauthorized';
    return next(unauthorized);
  }
}

function requireUserAuthorization(req, res, next) {
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    if (decodedToken.username) {
      req.username = decodedToken.username;
      return next();
    }
  } catch (e) {
    const unauthorized = new Error('Only users can access this resource.');
    unauthorized.status = 401;
    unauthorized.title = 'Unauthorized';
    return next(unauthorized);
  }
}
function requireCompanyAuthorization(req, res, next) {
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    if (decodedToken.handle) {
      req.company = decodedToken.handle;
      return next();
    }
  } catch (e) {
    const unauthorized = new Error('Only companies can access this resource.');
    unauthorized.status = 401;
    unauthorized.title = 'Unauthorized';
    return next(unauthorized);
  }
}

function requireCorrectUser(req, res, next) {
  // Verifies token and correct user
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    if (decodedToken.username === req.params.username) {
      return next();
    } else {
      throw 'Forbidden';
    }
  } catch (e) {
    const forbidden = new Error('You are not allowed to access this resource.');
    forbidden.status = 403;
    forbidden.title = 'Forbidden';
    return next(forbidden);
  }
}

function requireCorrectCompany(req, res, next) {
  //Verifies the token and correct company
  try {
    const token = req.headers.authorization;
    const decodedToken = jwt.verify(token, 'I_AM_THE_SECRET_KEY');
    if (decodedToken.handle === req.params.handle) {
      // req.company = decodedToken.handle;
      return next();
    } else {
      throw 'Forbidden';
    }
  } catch (e) {
    const forbidden = new Error('You are not allowed to access this resource.');
    forbidden.status = 403;
    forbidden.title = 'Forbidden';
    return next(forbidden);
  }
}

module.exports = {
  requireAuthorization,
  requireUserAuthorization,
  requireCompanyAuthorization,
  requireCorrectUser,
  requireCorrectCompany
};
