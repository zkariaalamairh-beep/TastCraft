import { authRequest } from './auth.js';

// GET /api/auth/staff — list every staff member with roles.
export function getStaff() {
  return authRequest('/auth/staff');
}

// POST /api/auth/staff — Manager creates Kitchen, Owner both.
export function createStaff(payload) {
  return authRequest('/auth/staff', {
    method: 'POST',
    body: payload,
  });
}

// PUT /api/auth/staff/{id}/role — Owner only.
export function updateStaffRole(id, role) {
  return authRequest(`/auth/staff/${id}/role`, {
    method: 'PUT',
    body: { role },
  });
}