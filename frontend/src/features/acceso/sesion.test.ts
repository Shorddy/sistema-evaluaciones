import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardarSesion, leerSesionGuardada } from './sesion';
import type { Sesion } from './tipos';

const memoria = () => {
  const datos = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  });
};

const sesion = (expiraEn: string): Sesion => ({
  token: 't',
  expiraEn,
  rolActivo: 'PSICOLOGO',
  permisos: [],
  correo: 'a@uam.edu',
});

afterEach(() => vi.unstubAllGlobals());

describe('sesión guardada', () => {
  it('se recupera mientras no haya vencido', () => {
    memoria();
    const viva = sesion(new Date(Date.now() + 60_000).toISOString());
    guardarSesion(viva);
    expect(leerSesionGuardada()).toEqual(viva);
  });

  it('una sesión vencida no se recupera', () => {
    memoria();
    guardarSesion(sesion(new Date(Date.now() - 1000).toISOString()));
    expect(leerSesionGuardada()).toBeNull();
  });

  it('guardar null la borra', () => {
    memoria();
    guardarSesion(sesion(new Date(Date.now() + 60_000).toISOString()));
    guardarSesion(null);
    expect(leerSesionGuardada()).toBeNull();
  });

  it('sin almacenamiento disponible no falla', () => {
    expect(leerSesionGuardada()).toBeNull();
    expect(() => guardarSesion(null)).not.toThrow();
  });
});
