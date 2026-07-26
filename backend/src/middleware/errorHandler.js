// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'INTERNAL_ERROR',
    message: status === 500 ? 'Something went wrong' : err.message,
  });
}

module.exports = { errorHandler };
