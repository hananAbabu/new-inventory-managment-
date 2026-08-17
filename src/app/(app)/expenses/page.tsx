'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { deleteExpense, saveExpense } from '@/app/actions/expenses';
import { Icon } from '@/components/icon';
import { Modal, ModalBody, ModalFooter, useConfirm } from '@/components/modal';
import { useStore } from '@/components/store';
import { useToast } from '@/components/toast';
import { Badge, EmptyState, Pager, StatStrip, usePaged } from '@/components/ui';
import { BANKS, PAY_METHODS, bankShort, needsBank, payMethodLabel } from '@/lib/banks';
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  expenseCategoryTone,
} from '@/lib/expenses';
import { userName } from '@/lib/selectors';
import type { Bank, Expense, ExpenseCategory, PayMethod } from '@/lib/types';
import { DAY, fd, startOfDay } from '@/lib/utils';

const RANGES = [0, 7, 30, -1];

function rangeLabel(r: number): string {
  return r === 0 ? 'Today' : r === -1 ? 'All time' : `${r} days`;
}

export default function ExpensesPage() {
  const { db, run, money } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [range, setRange] = useState(30);
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const list = useMemo(() => {
    const from = range === 0 ? startOfDay(Date.now()) : range === -1 ? 0 : Date.now() - range * DAY;
    return [...db.expenses]
      .sort((a, b) => b.date - a.date)
      .filter((e) => e.date >= from && (category === 'all' || e.category === category));
  }, [db.expenses, range, category]);

  const { rows, page, pages, setPage, total } = usePaged(list, 10);

  const totalAmount = list.reduce((a, e) => a + e.amount, 0);
  const cashAmount = list.filter((e) => !e.bank).reduce((a, e) => a + e.amount, 0);

  function openForm(expense: Expense | null) {
    setEditing(expense);
    setFormOpen(true);
  }

  async function del(expense: Expense) {
    const ok = await confirm({
      title: 'Delete expense',
      message: (
        <>
          Delete <b>{expense.ref}</b> — {expense.description} ({money(expense.amount)})?
        </>
      ),
      danger: true,
      confirm: 'Delete',
    });
    if (!ok) return;
    if (await run(() => deleteExpense(expense.id))) toast('Expense deleted');
  }

  return (
    <div className="card">
      <div className="toolbar">
        {RANGES.map((r) => (
          <button
            key={r}
            className={`chip ${range === r ? 'on' : ''}`}
            onClick={() => {
              setRange(r);
              setPage(1);
            }}
          >
            {rangeLabel(r)}
          </button>
        ))}
        <select
          className="select"
          style={{ width: '190px' }}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as ExpenseCategory | 'all');
            setPage(1);
          }}
        >
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => openForm(null)}>
          <Icon name="plus" /> Record expense
        </button>
      </div>

      <StatStrip
        bordered
        stats={[
          { label: 'Entries', value: list.length },
          { label: 'Total spent', value: money(totalAmount), accent: true },
          { label: 'Paid in cash', value: money(cashAmount) },
          { label: 'Paid via bank', value: money(totalAmount - cashAmount) },
        ]}
      />

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Payment</th>
              <th>Recorded by</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <b>{e.ref}</b>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fd(e.date)}</td>
                  <td>
                    <Badge tone={expenseCategoryTone(e.category)}>
                      {expenseCategoryLabel(e.category)}
                    </Badge>
                  </td>
                  <td>{e.description}</td>
                  <td>
                    <Badge tone="b-gray">{payMethodLabel(e.payMethod)}</Badge>
                    {e.bank ? (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        {bankShort(e.bank)}
                        {e.txnRef ? ` · ${e.txnRef}` : ''}
                      </div>
                    ) : null}
                  </td>
                  <td>{userName(db, e.byUserId)}</td>
                  <td className="num">
                    <b>{money(e.amount)}</b>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn sm" title="Edit" onClick={() => openForm(e)}>
                      <Icon name="pencil" />
                    </button>{' '}
                    <button className="icon-btn sm danger" title="Delete" onClick={() => del(e)}>
                      <Icon name="trash" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon="receipt"
                    title="No expenses in this period"
                    sub="Record rent, salaries, transport and other running costs here."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager total={total} page={page} pages={pages} onPage={setPage} />

      {formOpen ? (
        <ExpenseForm
          key={editing?.id ?? 'new'}
          expense={editing}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </div>
  );
}

function toDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ExpenseForm({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { run } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState(toDateInput(expense?.date ?? Date.now()));
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'rent');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [payMethod, setPayMethod] = useState<PayMethod>(expense?.payMethod ?? 'cash');
  const [bank, setBank] = useState<Bank>(expense?.bank ?? 'cbe');
  const [txnRef, setTxnRef] = useState(expense?.txnRef ?? '');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const desc = description.trim();
    const amountV = parseFloat(amount);
    if (!desc) {
      toast('Enter what the money was spent on', 'error');
      return;
    }
    if (!(amountV > 0)) {
      toast('Amount must be greater than zero', 'error');
      return;
    }
    const parsedDate = new Date(date + 'T12:00:00').getTime();
    if (isNaN(parsedDate)) {
      toast('Enter a valid date', 'error');
      return;
    }

    setBusy(true);
    const ok = await run(() =>
      saveExpense(expense?.id ?? null, {
        date: parsedDate,
        category,
        description: desc,
        amount: amountV,
        payMethod,
        bank: needsBank(payMethod) ? bank : null,
        txnRef: needsBank(payMethod) ? txnRef.trim() || null : null,
      }),
    );
    setBusy(false);
    if (!ok) return;

    toast(expense ? 'Expense updated' : 'Expense recorded');
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={expense ? `Edit ${expense.ref}` : 'Record expense'}>
      <form onSubmit={onSubmit}>
        <ModalBody>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="field">
              <label htmlFor="ex-date">Date *</label>
              <input
                id="ex-date"
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ex-cat">Category *</label>
              <select
                id="ex-cat"
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                required
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="ex-desc">Description *</label>
            <input
              id="ex-desc"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Store rent — monthly"
              required
            />
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div className="field">
              <label htmlFor="ex-amount">Amount *</label>
              <input
                id="ex-amount"
                className="input"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ex-method">Paid by *</label>
              <select
                id="ex-method"
                className="select"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PayMethod)}
              >
                {PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {needsBank(payMethod) ? (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
              <div className="field">
                <label htmlFor="ex-bank">Bank *</label>
                <select
                  id="ex-bank"
                  className="select"
                  value={bank}
                  onChange={(e) => setBank(e.target.value as Bank)}
                >
                  {BANKS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ex-txn">Transaction number</label>
                <input
                  id="ex-txn"
                  className="input"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
          ) : null}
        </ModalBody>

        <ModalFooter>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Icon name="check" /> {expense ? 'Save changes' : 'Record expense'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
