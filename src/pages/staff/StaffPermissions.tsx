import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { rolePermissionService } from '@/services/staffService';
import { USER_ROLES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';
import Select from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Shield } from 'lucide-react';

const MODULES = [
  'students', 'attendance', 'grades', 'fees', 'classes', 'library',
  'communications', 'guidance', 'idcards', 'reports', 'settings', 'staff',
];

const ACTIONS = ['create', 'read', 'update', 'delete', 'approve'] as const;

const ROLE_OPTIONS = [
  { label: 'Select Role', value: '' },
  { label: 'Principal', value: USER_ROLES.PRINCIPAL },
  { label: 'Vice Principal', value: USER_ROLES.VICE_PRINCIPAL },
  { label: 'Registrar', value: USER_ROLES.REGISTRAR },
  { label: 'Bursar', value: USER_ROLES.BURSAR },
  { label: 'Dean of Students', value: USER_ROLES.DEAN },
  { label: 'Admin Staff', value: USER_ROLES.ADMIN_STAFF },
  { label: 'IT Admin', value: USER_ROLES.IT_ADMIN },
  { label: 'Teacher', value: USER_ROLES.TEACHER },
  { label: 'Librarian', value: USER_ROLES.LIBRARIAN },
  { label: 'Guidance Counselor', value: USER_ROLES.COUNSELOR },
];

type PermRow = {
  id: string;
  role: UserRole;
  module: string;
  action: string;
};

export default function StaffPermissions() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [selectedRole, setSelectedRole] = useState('');

  // Fetch permissions for selected role
  const { data: permissions } = useFetch(
    ['permissions', schoolId, selectedRole],
    () => rolePermissionService.listPermissions(schoolId, selectedRole as UserRole),
    { enabled: !!schoolId && !!selectedRole },
  );

  const perms = (permissions ?? []) as unknown as PermRow[];

  // Check if a permission exists
  const hasPerm = (module: string, action: string) =>
    perms.some((p) => p.module === module && p.action === action);

  const getPermId = (module: string, action: string) =>
    perms.find((p) => p.module === module && p.action === action)?.id;

  const grantPerm = useMutate(
    (args: { module: string; action: string }) =>
      rolePermissionService.grantPermission({
        school_id: schoolId,
        role: selectedRole as UserRole,
        module: args.module,
        action: args.action,
      }),
    [['permissions']],
    { onSuccess: () => notify.success('Permission granted') },
  );

  const revokePerm = useMutate(
    (id: string) => rolePermissionService.revokePermission(id),
    [['permissions']],
    { onSuccess: () => notify.success('Permission revoked') },
  );

  const togglePerm = (module: string, action: string) => {
    if (hasPerm(module, action)) {
      const id = getPermId(module, action);
      if (id) revokePerm.mutate(id);
    } else {
      grantPerm.mutate({ module, action });
    }
  };

  // Role summary
  const { data: roles } = useFetch(
    ['user-roles', schoolId],
    () => rolePermissionService.listRoles(schoolId),
    { enabled: !!schoolId },
  );

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Staff', href: '/staff' }, { label: 'Permissions' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" /> Role Permissions
        </h1>
      </div>

      {/* Role Selector */}
      <Card className="p-4">
        <div className="flex items-end gap-4">
          <div className="w-64">
            <Select label="Select Role" options={ROLE_OPTIONS} value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)} />
          </div>
          {selectedRole && (
            <div className="pb-2">
              <Badge variant="info">{selectedRole.replace(/_/g, ' ')}</Badge>
              <span className="text-xs text-slate-500 ml-2">{perms.length} permissions assigned</span>
            </div>
          )}
        </div>
      </Card>

      {/* Roles Overview */}
      {!selectedRole && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(roles ?? []).map((r) => (
            <Card key={r.id} className="p-4 cursor-pointer hover:border-blue-300 transition-colors"
              onClick={() => setSelectedRole(r.role_name)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.role_name.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400">{(r.permissions ?? []).length} permissions</p>
                </div>
                <Shield className="h-4 w-4 text-slate-300" />
              </div>
            </Card>
          ))}
          {(roles ?? []).length === 0 && (
            <Card className="p-8 text-center text-slate-400 col-span-full">
              No role configurations found. Permissions can be managed per role.
            </Card>
          )}
        </div>
      )}

      {/* Permission Matrix */}
      {selectedRole && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Module</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="text-center px-3 py-3 font-semibold text-slate-700 capitalize">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod) => (
                  <tr key={mod} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700 capitalize">{mod}</td>
                    {ACTIONS.map((action) => (
                      <td key={action} className="text-center px-3 py-3">
                        <button onClick={() => togglePerm(mod, action)}
                          className={`w-6 h-6 rounded border-2 transition-colors inline-flex items-center justify-center ${
                            hasPerm(mod, action)
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'bg-white border-slate-300 hover:border-blue-400'
                          }`}>
                          {hasPerm(mod, action) && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}