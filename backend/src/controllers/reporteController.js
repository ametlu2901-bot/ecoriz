const asyncHandler = require('./asyncHandler');
const { AppError } = require('../utils/errors');

const idDe = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'NO_ENCONTRADO', 'El recurso no existe.');
  return id;
};

module.exports = ({ reporteService }) => ({
  cercanos: asyncHandler(async (req, res) => {
    res.status(200).json(await reporteService.cercanos(req.query));
  }),
  crear: asyncHandler(async (req, res) => {
    // multipart/form-data: los campos de texto llegan en req.body y la foto en req.file
    res.status(201).json(await reporteService.registrar(req.usuario, req.body || {}, req.file));
  }),
  obtener: asyncHandler(async (req, res) => {
    res.status(200).json(await reporteService.obtener(req.usuario, idDe(req)));
  }),
  listar: asyncHandler(async (req, res) => {
    res.status(200).json(await reporteService.listar(req.query));
  }),
  historial: asyncHandler(async (req, res) => {
    res.status(200).json(await reporteService.historial(req.usuario, idDe(req)));
  }),
});
