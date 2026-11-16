class AppError extends Error {
  constructor(status, codigo, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.extra = extra;
  }
}

/** 400 con la lista de campos inválidos y su motivo (sección 6.1 de la Fase 2). */
class ValidationError extends AppError {
  constructor(campos) {
    super(400, 'VALIDACION', 'Hay campos inválidos', { campos });
    this.campos = campos;
  }
}

module.exports = { AppError, ValidationError };
