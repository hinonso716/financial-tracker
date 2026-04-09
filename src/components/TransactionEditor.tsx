import type { FormEvent } from 'react'

import type { Category, TransactionType } from '../lib/finance'

type TransactionEditorProps = {
  editing: boolean
  form: {
    type: TransactionType
    categoryId: string
    amount: string
    occurredAt: string
    note: string
  }
  categoryOptions: Category[]
  onFormChange: (nextForm: {
    type: TransactionType
    categoryId: string
    amount: string
    occurredAt: string
    note: string
  }) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

function TransactionEditor({
  editing,
  form,
  categoryOptions,
  onFormChange,
  onSubmit,
  onCancel,
}: TransactionEditorProps) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <div className="field-row">
        <label className="field">
          <span>Type</span>
          <select
            value={form.type}
            onChange={(event) =>
              onFormChange({
                ...form,
                type: event.target.value as TransactionType,
              })
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>

        <label className="field">
          <span>Category</span>
          <select
            value={form.categoryId}
            onChange={(event) =>
              onFormChange({
                ...form,
                categoryId: event.target.value,
              })
            }
          >
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.amount}
            onChange={(event) =>
              onFormChange({
                ...form,
                amount: event.target.value,
              })
            }
          />
        </label>

        <label className="field">
          <span>Date</span>
          <input
            type="date"
            required
            value={form.occurredAt}
            onChange={(event) =>
              onFormChange({
                ...form,
                occurredAt: event.target.value,
              })
            }
          />
        </label>
      </div>

      <label className="field">
        <span>Note / description</span>
        <textarea
          rows={3}
          value={form.note}
          onChange={(event) =>
            onFormChange({
              ...form,
              note: event.target.value,
            })
          }
          placeholder="Optional details such as merchant, trip, or bill context"
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="button button-primary">
          {editing ? 'Update transaction' : 'Save transaction'}
        </button>
        {editing ? (
          <button type="button" className="button button-secondary" onClick={onCancel}>
            Cancel edit
          </button>
        ) : null}
      </div>
    </form>
  )
}

export default TransactionEditor
