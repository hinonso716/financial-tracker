import type { FormEvent } from 'react'

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
}: CategoryManagerProps) {
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
        {(['expense', 'income'] as CategoryKind[]).map((kind) => (
          <section key={kind} className="category-group">
            <div className="subheader">
              <h3>{kind === 'expense' ? 'Expense categories' : 'Income categories'}</h3>
            </div>

            <div className="category-list">
              {categories
                .filter((category) => category.kind === kind)
                .map((category) => (
                  <article
                    key={category.id}
                    className={`category-row ${category.archived ? 'archived' : ''}`}
                  >
                    <div className="category-row-main">
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
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

export default CategoryManager
