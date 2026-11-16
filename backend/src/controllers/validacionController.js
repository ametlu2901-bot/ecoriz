const asyncHandler = require('./asyncHandler');
const { AppError } = require('../utils/errors');

module.exports = ({ validacionService }) => ({
  decidir: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'NO_ENCONTRADO', 'El reporte no existe.');
    res.status(200).json(await validacionService.decidir(req.usuario, id, req.body || {}));
  }),
});
