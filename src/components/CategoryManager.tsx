import type { FormEvent } from 'react'
import { useState } from 'react'

import type { Category, CategoryKind } from '../lib/finance'

type CategoryManagerProps = {
  categories: Category[]
  categoryForm: {
    name: string
    kind: CategoryKind
  }
  categoryDrafts: Record<string, string>
  activeCounts: Record<CategoryKind, number>
  onCategoryFormChange: (nextForm: { name: string; kind: CategoryKind }) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDraftChange: (categoryId: string, value: string) => void
  onRename: (categoryId: string) => void
  onArchive: (categoryId: string) => void
  onRestore: (categoryId: string) => void
  onReorderExpenseCategories: (sourceId: string, targetId: string) => void
  onMoveExpenseCategory: (categoryId: string, direction: 'up' | 'down') => void
}

function CategoryManager({
  categories,
  categoryForm,
  categoryDrafts,
  activeCounts,
  onCategoryFormChange,
  onSubmit,
  onDraftChange,
  onRename,
  onArchive,
  onRestore,
  onReorderExpenseCategories,
  onMoveExpenseCategory,
}: CategoryManagerProps) {
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null)

  return (
    <>
      <form className="category-create" onSubmit={onSubmit}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            required
            value={categoryForm.name}
            onChange={(event) =>
              onCategoryFormChange({
                ...categoryForm,
                name: event.target.value,
              })
            }
            placeholder="Add a category"
          />
        </label>
        <label className="field">
          <span>Kind</span>
          <select
            value={categoryForm.kind}
            onChange={(event) =>
              onCategoryFormChange({
                ...categoryForm,
                kind: event.target.value as CategoryKind,
              })
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <button type="submit" className="button button-primary">
          Add category
        </button>
      </form>

      <div className="category-groups">
        {(['expense', 'income'] as CategoryKind[]).map((kind) => {
          const groupedCategories = categories.filter((category) => category.kind === kind)

          return (
            <section key={kind} className="category-group">
              <div className="subheader">
                <h3>{kind === 'expense' ? 'Expense categories' : 'Income categories'}</h3>
                {kind === 'expense' ? (
                  <p className="page-description">
                    Drag to reorder, or use the arrow buttons to sort the expense list your
                    way.
                  </p>
                ) : null}
              </div>

              <div className="category-list">
                {groupedCategories.map((category, index) => {
                  const isExpense = kind === 'expense'

                  return (
                    <article
                      key={category.id}
                      className={`category-row ${category.archived ? 'archived' : ''} ${
                        draggingCategoryId === category.id ? 'dragging' : ''
                      } ${isExpense ? 'sortable' : ''}`}
                      draggable={isExpense}
                      onDragStart={() => setDraggingCategoryId(category.id)}
                      onDragEnd={() => setDraggingCategoryId(null)}
                      onDragOver={(event) => {
                        if (isExpense && draggingCategoryId && draggingCategoryId !== category.id) {
                          event.preventDefault()
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()

                        if (
                          isExpense &&
                          draggingCategoryId &&
                          draggingCategoryId !== category.id
                        ) {
                          onReorderExpenseCategories(draggingCategoryId, category.id)
                        }

                        setDraggingCategoryId(null)
                      }}
                    >
                      <div className="category-row-main">
                        {isExpense ? <span className="drag-handle">Drag</span> : null}
                        <input
                          type="text"
                          value={categoryDrafts[category.id] ?? category.name}
                          onChange={(event) =>
                            onDraftChange(category.id, event.target.value)
                          }
                        />
                        <span className="category-tag">
                          {category.archived ? 'Archived' : 'Active'}
                        </span>
                      </div>

                      <div className="category-row-actions">
                        {isExpense ? (
                          <>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={index === 0}
                              onClick={() => onMoveExpenseCategory(category.id, 'up')}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={index === groupedCategories.length - 1}
                              onClick={() => onMoveExpenseCategory(category.id, 'down')}
                            >
                              Down
                            </button>
                          </>
                        ) : null}

                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => onRename(category.id)}
                        >
                          Save
                        </button>
                        {category.archived ? (
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => onRestore(category.id)}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={activeCounts[category.kind] <= 1}
                            onClick={() => onArchive(category.id)}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

export default CategoryManager
