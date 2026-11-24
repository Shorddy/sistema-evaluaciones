import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, establecerToken, http, registrarAlExpirar } from './http';

const responder = (status: number, cuerpo?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status }),
      ),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  establecerToken(null);
  registrarAlExpirar(null);
});

describe('http', () => {
  it('llama a /api/v1 y devuelve el JSON', async () => {
    responder(200, [{ id: 1 }]);
    await expect(http('/tests')).resolves.toEqual([{ id: 1 }]);
    expect(fetch).toHaveBeenCalledWith('/api/v1/tests', expect.anything());
  });

  it('convierte el error del backend en ApiError con su código', async () => {
    responder(409, {
      timestamp: 't',
      status: 409,
      codigo: 'EVALUACION_FINALIZADA',
      mensaje: 'Ya finalizó.',
      ruta: '/x',
    });
    await expect(http('/x')).rejects.toMatchObject({
      status: 409,
      error: { codigo: 'EVALUACION_FINALIZADA' },
    });
  });

  it('sin cuerpo de error conserva el estado HTTP', async () => {
    responder(502);
    const fallo = await http('/x').catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(ApiError);
    expect((fallo as ApiError).status).toBe(502);
    expect((fallo as ApiError).error).toBeUndefined();
  });

  it('envía el token como Bearer cuando hay sesión', async () => {
    responder(200, {});
    establecerToken('abc');
    await http('/tests');
    const opciones = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(opciones.headers).toMatchObject({ Authorization: 'Bearer abc' });
  });

  it('sin sesión no envía Authorization', async () => {
    responder(200, {});
    await http('/tests');
    const opciones = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(opciones.headers).not.toHaveProperty('Authorization');
  });

  it('401 con sesión avisa para volver a login y sigue lanzando ApiError', async () => {
    const alExpirar = vi.fn();
    registrarAlExpirar(alExpirar);
    establecerToken('vencido');
    responder(401, {
      timestamp: 't',
      status: 401,
      codigo: 'NO_AUTENTICADO',
      mensaje: 'x',
      ruta: '/x',
    });
    await expect(http('/x')).rejects.toMatchObject({ status: 401 });
    expect(alExpirar).toHaveBeenCalledOnce();
  });

  it('401 sin sesión (login fallido) no dispara la salida', async () => {
    const alExpirar = vi.fn();
    registrarAlExpirar(alExpirar);
    responder(401, {
      timestamp: 't',
      status: 401,
      codigo: 'CREDENCIALES_INVALIDAS',
      mensaje: 'x',
      ruta: '/x',
    });
    await expect(http('/auth/sesion', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(alExpirar).not.toHaveBeenCalled();
  });
});
