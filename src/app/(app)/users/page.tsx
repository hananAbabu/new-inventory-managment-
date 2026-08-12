'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter, useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge } from '@/components/ui';
import type { BadgeTone } from '@/lib/selectors';
import type { Role, User } from '@/lib/types';
import { fdS, initials, uid } from '@/lib/utils';

const ROLE_TONE: Record<Role, BadgeTone> = {
  admin: 'b-violet',
  shopkeeper: 'b-green',
  cashier: 'b-blue',
};

const ROLES: Role[] = ['admin', 'shopkeeper', 'cashier'];

export default function UsersPage() {
  const { db, me, update } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const activeAdmins = () => db.users.filter((x) => x.role === 'admin' && x.active).length;

  function openForm(u: User | null) {
    setEditing(u);
    setFormOpen(true);
  }

  function toggleActive(u: User) {
    if (u.id === me!.id) {
      toast('You cannot deactivate your own account', 'error');
      return;
    }
    if (u.role === 'admin' && u.active && activeAdmins() <= 1) {
      toast('Cannot deactivate the last active admin', 'error');
      return;
    }
    const nextActive = !u.active;
    update((draft, audit) => {
      const target = draft.users.find((x) => x.id === u.id);
      if (!target) return;
      target.active = nextActive;
      audit(
        'USER',
        nextActive ? 'activate' : 'deactivate',
        `User ${u.username} ${nextActive ? 'activated' : 'deactivated'}`,
      );
    });
    toast(nextActive ? 'User activated' : 'User deactivated');
  }

  async function del(u: User) {
    if (u.id === me!.id) {
      toast('You cannot delete your own account', 'error');
      return;
    }
    if (u.role === 'admin' && activeAdmins() <= 1) {
      toast('Cannot delete the last active admin', 'error');
      return;
    }
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
    update((draft, audit) => {
      draft.users = draft.users.filter((x) => x.id !== u.id);
      audit('USER', 'delete', 'Deleted user ' + u.username);
    });
    toast('User deleted');
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
  const { db, update } = useStore();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'admin');
  const [password, setPassword] = useState('');

  function onSubmit(e: FormEvent) {
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

    if (user) {
      if (
        user.role === 'admin' &&
        role !== 'admin' &&
        db.users.filter((x) => x.role === 'admin' && x.active).length <= 1
      ) {
        toast('Cannot demote the last active admin', 'error');
        return;
      }
      update((draft, audit) => {
        const u = draft.users.find((x) => x.id === user.id);
        if (!u) return;
        u.name = nameV;
        u.username = userV;
        u.role = role;
        if (password) u.password = password;
        audit('USER', 'edit', `Updated user ${userV} (role: ${role})`);
      });
    } else {
      if (!password || password.length < 4) {
        toast('Password must be at least 4 characters', 'error');
        return;
      }
      update((draft, audit) => {
        draft.users.push({
          id: uid(draft.users),
          name: nameV,
          username: userV,
          password,
          role,
          active: true,
          createdAt: Date.now(),
        });
        audit('USER', 'add', `Created user ${userV} (role: ${role})`);
      });
    }

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
          <button className="btn btn-primary" type="submit">
            <Icon name="check" /> Save user
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
