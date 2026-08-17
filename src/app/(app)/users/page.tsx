'use client';

import { useState, type FormEvent } from 'react';
import { deleteUser, saveUser, toggleUserActive } from '@/app/actions/admin';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter, useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge } from '@/components/ui';
import type { BadgeTone } from '@/lib/selectors';
import type { Role, User } from '@/lib/types';
import { fdS, initials } from '@/lib/utils';

const ROLE_TONE: Record<Role, BadgeTone> = {
  admin: 'b-violet',
  storekeeper: 'b-green',
  cashier: 'b-blue',
};

const ROLES: Role[] = ['admin', 'storekeeper', 'cashier'];

export default function UsersPage() {
  const { db, me, run } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  function openForm(u: User | null) {
    setEditing(u);
    setFormOpen(true);
  }

  async function toggleActive(u: User) {
    const nextActive = !u.active;
    if (await run(() => toggleUserActive(u.id))) {
      toast(nextActive ? 'User activated' : 'User deactivated');
    }
  }

  async function del(u: User) {
    const ok = await confirm({
      title: 'Delete user',
      message: (
        <>
          Permanently remove <b>{u.name}</b> ({u.username})?
        </>
      ),
      danger: true,
      confirm: 'Delete',
    });
    if (!ok) return;
    if (await run(() => deleteUser(u.id))) toast('User deleted');
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>Users &amp; role assignments</h3>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => openForm(null)}>
          <Icon name="plus" /> Add user
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', gap: '9px', alignItems: 'center' }}>
                    <div
                      className="avatar"
                      style={{ width: 30, height: 30, flexBasis: '30px', fontSize: '11px' }}
                    >
                      {initials(u.name)}
                    </div>
                    <b>{u.name}</b>
                    {u.id === me!.id ? <Badge tone="b-blue">you</Badge> : null}
                  </div>
                </td>
                <td>{u.username}</td>
                <td>
                  <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                </td>
                <td>
                  {u.active ? (
                    <Badge tone="b-green">Active</Badge>
                  ) : (
                    <Badge tone="b-red">Deactivated</Badge>
                  )}
                </td>
                <td>{fdS(u.createdAt)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="icon-btn sm" title="Edit" onClick={() => openForm(u)}>
                    <Icon name="pencil" />
                  </button>{' '}
                  <button
                    className="icon-btn sm"
                    title={u.active ? 'Deactivate' : 'Activate'}
                    onClick={() => toggleActive(u)}
                  >
                    <Icon name={u.active ? 'lock' : 'check'} />
                  </button>{' '}
                  <button className="icon-btn sm danger" title="Delete" onClick={() => del(u)}>
                    <Icon name="trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <UserForm key={editing?.id ?? 'new'} user={editing} onClose={() => setFormOpen(false)} />
      ) : null}
    </div>
  );
}

function UserForm({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { db, run } = useStore();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nameV = name.trim();
    const userV = username.trim().toLowerCase();
    if (!nameV || !userV) {
      toast('Name and username are required', 'error');
      return;
    }
    if (db.users.some((u) => u.username.toLowerCase() === userV && u.id !== user?.id)) {
      toast('Username already taken', 'error');
      return;
    }

    setBusy(true);
    const ok = await run(() =>
      saveUser(user?.id ?? null, { name: nameV, username: userV, role, password }),
    );
    setBusy(false);
    if (!ok) return;

    toast('User saved');
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={user ? 'Edit user' : 'Add user'}>
      <form onSubmit={onSubmit}>
        <ModalBody>
          <div className="field">
            <label htmlFor="uf-name">Full name *</label>
            <input
              id="uf-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="field">
              <label htmlFor="uf-user">Username *</label>
              <input
                id="uf-user"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="uf-role">Role *</label>
              <select
                id="uf-role"
                className="select"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="uf-pass">
              {user ? 'New password (leave blank to keep current)' : 'Password *'}
            </label>
            <input
              id="uf-pass"
              className="input"
              type="password"
              required={!user}
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="hint">Minimum 4 characters.</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="check" /> Save user
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
