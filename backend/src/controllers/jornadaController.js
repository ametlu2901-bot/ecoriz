const asyncHandler = require('./asyncHandler');
const { AppError } = require('../utils/errors');

const idDe = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'NO_ENCONTRADO', 'La jornada no existe.');
  return id;
};

module.exports = ({ jornadaService, organizacionRepo }) => ({
  crear: asyncHandler(async (req, res) => {
    res.status(201).json(await jornadaService.crear(req.usuario, req.body || {}));
  }),
  actualizar: asyncHandler(async (req, res) => {
    res.status(200).json(await jornadaService.actualizar(req.usuario, idDe(req), req.body || {}));
  }),
  publicar: asyncHandler(async (req, res) => {
    res.status(200).json(await jornadaService.publicar(req.usuario, idDe(req)));
  }),
  cerrar: asyncHandler(async (req, res) => {
    res.status(200).json(await jornadaService.cerrar(req.usuario, idDe(req), req.body || {}));
  }),
  listar: asyncHandler(async (req, res) => {
    res.status(200).json(await jornadaService.listar(req.usuario, req.query));
  }),
  // Ruta auxiliar (no está en la tabla 6.1): alimenta la lista "Organización responsable"
  organizaciones: asyncHandler(async (_req, res) => {
    res.status(200).json(await organizacionRepo.listar());
  }),
});
