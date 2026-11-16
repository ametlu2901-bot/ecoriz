const asyncHandler = require('./asyncHandler');

module.exports = ({ authService }) => ({
  login: asyncHandler(async (req, res) => {
    res.status(200).json(await authService.login(req.body));
  }),
});
