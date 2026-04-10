import {
  formatDisplayDate,
  formatSignedCurrency,
  getCategoryName,
} from '../lib/finance'
import type { Category, Transaction, TransactionType } from '../lib/finance'

type TransactionsTableProps = {
  categories: Category[]
  transactions: Transaction[]
  transactionTypeFilter: 'all' | TransactionType
  transactionCategoryFilter: string
  currency: string
  onTypeFilterChange: (value: 'all' | TransactionType) => void
  onCategoryFilterChange: (value: string) => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transactionId: string) => void
}

function TransactionsTable({
  categories,
  transactions,
  transactionTypeFilter,
  transactionCategoryFilter,
  currency,
  onTypeFilterChange,
  onCategoryFilterChange,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  const renderAmount = (transaction: Transaction) =>
    transaction.type === 'income'
      ? formatSignedCurrency(transaction.amount, currency)
      : formatSignedCurrency(-transaction.amount, currency)

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>Type filter</span>
          <select
            value={transactionTypeFilter}
            onChange={(event) =>
              onTypeFilterChange(event.target.value as 'all' | TransactionType)
            }
          >
            <option value="all">All</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
        </label>

        <label className="field">
          <span>Category filter</span>
          <select
            value={transactionCategoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {transactions.length > 0 ? (
        <div className="records-list" data-testid="transactions-mobile-list">
          {transactions.map((transaction) => (
            <article className="record-card" key={transaction.id}>
              <div className="record-card-header">
                <div>
                  <p className="record-card-date">
                    {formatDisplayDate(transaction.occurredAt)}
                  </p>
                  <strong>{getCategoryName(categories, transaction.categoryId)}</strong>
                </div>
                <span className={`status-pill ${transaction.type}`}>
                  {transaction.type}
                </span>
              </div>

              <p className="record-card-note">{transaction.note || 'No note'}</p>

              <div className="record-card-footer">
                <span className={transaction.type === 'income' ? 'positive' : 'negative'}>
                  {renderAmount(transaction)}
                </span>
                <div className="row-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => onEdit(transaction)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => onDelete(transaction.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state small">
          <h3>No transactions in this view</h3>
          <p>
            Change the timeframe, move to another period, or add a transaction to
            populate the records.
          </p>
        </div>
      )}

      <div className="table-shell desktop-table-shell">
        <table className="data-table" data-testid="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Note</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDisplayDate(transaction.occurredAt)}</td>
                  <td>
                    <span className={`status-pill ${transaction.type}`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td>{getCategoryName(categories, transaction.categoryId)}</td>
                  <td>{transaction.note || 'No note'}</td>
                  <td className={transaction.type === 'income' ? 'positive' : 'negative'}>
                    {renderAmount(transaction)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => onEdit(transaction)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => onDelete(transaction.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state small">
                    <h3>No transactions in this view</h3>
                    <p>
                      Change the timeframe, move to another period, or add a
                      transaction to populate the records.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default TransactionsTable
