import { useState, useEffect } from 'react'
import Modal from '../../shared/Modal'
import Button from '../../shared/Button'
import Select, { SelectItem } from '../../shared/Select'
import DatePicker from '../../shared/DatePicker'

export default function AddTodoModal({ isOpen, onClose, onAdd, travelers, statuses }) {
  const [todoData, setTodoData] = useState({
    text: '',
    assigneeId: 'unassigned',
    dueDate: '',
    status: statuses[0]?.id || 'not_started'
  })

  useEffect(() => {
    if (isOpen) {
      setTodoData({
        text: '',
        assigneeId: 'unassigned',
        dueDate: '',
        status: statuses[0]?.id || 'not_started'
      })
    }
  }, [isOpen, statuses])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!todoData.text.trim()) return
    onAdd({
      text: todoData.text.trim(),
      assigneeId: todoData.assigneeId === 'unassigned' ? null : todoData.assigneeId,
      dueDate: todoData.dueDate || '',
      status: todoData.status,
      done: todoData.status === 'done'
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✅ Create New Task">
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Task Description</label>
          <input
            value={todoData.text}
            onChange={e => setTodoData(prev => ({ ...prev, text: e.target.value }))}
            placeholder="e.g. Apply for Schengen Visa"
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Assignee</label>
            <Select value={todoData.assigneeId} onValueChange={v => setTodoData(prev => ({ ...prev, assigneeId: v }))}>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {travelers.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</label>
            <Select value={todoData.status} onValueChange={v => setTodoData(prev => ({ ...prev, status: v }))}>
              <SelectItem value="not_started">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-text-muted/60" />
                  Not Started
                </span>
              </SelectItem>
              <SelectItem value="in_progress">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  In Progress
                </span>
              </SelectItem>
              <SelectItem value="done">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  Done ✅
                </span>
              </SelectItem>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Due Date (Optional)</label>
          <DatePicker
            value={todoData.dueDate}
            onChange={v => setTodoData(prev => ({ ...prev, dueDate: v }))}
            placeholder="Set date"
          />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!todoData.text.trim()}>Create Task</Button>
        </div>
      </div>
    </Modal>
  )
}
