import { getUser, listUsers, updateUserRole as updateUserRoleRecord } from '../core/database/tables/users.table';
import { BadRequestError, ForbiddenError, NotFoundError } from '../core/errors/http-errors';
import type { UserRole } from '../core/types/data.types';
import { canManageRole, requireAdmin } from './roles.service';

function normalizeRole(value: unknown): UserRole {
    if (value === 'admin' || value === 'user') return value;
    if (value === 'owner') throw new ForbiddenError('Owner role cannot be assigned from the admin UI');
    throw new BadRequestError('Invalid role');
}

export async function listAdminUsers(userId: string) {
    await requireAdmin(userId);
    return listUsers();
}

export async function updateUserRole(actorId: string, targetUserId: string, role: unknown) {
    const actor = await requireAdmin(actorId);
    const target = await getUser(targetUserId);
    if (!target) throw new NotFoundError('Target user not found');

    const nextRole = normalizeRole(role);
    const targetRole = target.role ?? 'user';
    const actorRole = actor.role ?? 'user';

    if (!canManageRole(actorRole, targetRole, nextRole)) {
        throw new ForbiddenError('You cannot assign this role');
    }

    const updated = await updateUserRoleRecord(targetUserId, nextRole);
    if (!updated) throw new NotFoundError('Target user not found');
    return updated;
}
