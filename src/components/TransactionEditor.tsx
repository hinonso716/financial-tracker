import type { FormEvent } from 'react'

import SearchableCategorySelect from './SearchableCategorySelect'
import type { Category, TransactionType } from '../lib/finance'

type TransactionEditorProps = {
  editing: boolean
  form: {
    type: TransactionType
    categoryId: string
    amount: string
    occurredAt: string
    description: string
    remarks: string
  }
  categoryOptions: Category[]
  onFormChange: (nextForm: {
    type: TransactionType
    categoryId: string
    amount: string
    occurredAt: string
    description: string
    remarks: string
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

        <SearchableCategorySelect
          label="Category"
          value={form.categoryId}
          options={categoryOptions}
          onChange={(categoryId) =>
            onFormChange({
              ...form,
              categoryId,
            })
          }
        />
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

      <div className="field-row">
        <label className="field">
          <span>Description</span>
          <input
            type="text"
            value={form.description}
            onChange={(event) =>
              onFormChange({
                ...form,
                description: event.target.value,
              })
            }
            placeholder="Lunch, Uber ride, Salary..."
          />
        </label>

        <label className="field">
          <span>Remarks</span>
          <input
            type="text"
            value={form.remarks}
            onChange={(event) =>
              onFormChange({
                ...form,
                remarks: event.target.value,
              })
            }
            placeholder="Work, family, travel, reimbursement..."
          />
        </label>
      </div>

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
