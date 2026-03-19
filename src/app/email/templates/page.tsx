'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Save, Loader2, X, Edit, Trash2, FileText } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

interface Template {
  id: string
  name: string
  subject: string
  body: string
  category: string
  is_active: boolean
}

const CATEGORIES = ['follow_up', 'appointment', 'promotion', 'thank_you', 'reactivation', 'general']

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    const supabase = createClient()
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('name')

    setTemplates(data || [])
    setLoading(false)
  }

  function resetForm() {
    setName('')
    setSubject('')
    setBody('')
    setCategory('general')
    setEditingTemplate(null)
  }

  function openNew() {
    resetForm()
    setShowEditor(true)
  }

  function openEdit(template: Template) {
    setEditingTemplate(template)
    setName(template.name)
    setSubject(template.subject)
    setBody(template.body)
    setCategory(template.category || 'general')
    setShowEditor(true)
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim() || !body.trim()) return

    setSaving(true)
    const supabase = createClient()

    const templateData = {
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      category,
      is_active: true,
    }

    if (editingTemplate) {
      await supabase
        .from('email_templates')
        .update(templateData)
        .eq('id', editingTemplate.id)
    } else {
      await supabase.from('email_templates').insert(templateData)
    }

    setShowEditor(false)
    resetForm()
    fetchTemplates()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return

    const supabase = createClient()
    await supabase.from('email_templates').delete().eq('id', id)
    fetchTemplates()
  }

  return (
    <Layout currentPage="email">
      <div className="max-w-4xl">
        <Link href="/email" className="inline-flex items-center gap-2 text-gray-dark hover:text-body mb-3 font-body text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Email
        </Link>

        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-heading text-lg font-medium text-body">Email Templates</h1>
            <p className="font-body text-gray-dark">Create and manage email templates with variable placeholders</p>
          </div>
          <button
            onClick={openNew}
            className="bg-body hover:bg-body-hover text-white px-4 py-2 rounded font-body font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {/* Template Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-3 border-b border-gray-med flex items-center justify-between">
                <h2 className="font-heading text-base font-medium text-body">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h2>
                <button onClick={() => { setShowEditor(false); resetForm(); }} className="p-2 hover:bg-gray-light rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">Template Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Post-Fitting Follow Up"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body bg-white"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-body font-medium text-sm mb-2">Subject Line *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Great seeing you today, {FIRST_NAME}!"
                    className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                  />
                </div>

                <div>
                  <label className="block font-body font-medium text-sm mb-2">Email Body *</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    placeholder="Hi {FIRST_NAME},&#10;&#10;Thank you for visiting The Elevated Stag today..."
                    className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body resize-y"
                  />
                </div>

                <div className="bg-gray-light rounded p-4">
                  <p className="font-body text-xs text-gray-dark font-medium mb-2">Available Variables:</p>
                  <div className="flex flex-wrap gap-2">
                    {['{FIRST_NAME}', '{LAST_NAME}'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBody(prev => prev + v)}
                        className="px-2 py-1 bg-white border border-gray-med rounded font-body text-xs text-body hover:border-gold transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-gray-med flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
                  className="flex-1 bg-body hover:bg-body-hover disabled:bg-gray-med text-white py-2 rounded font-body font-medium flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingTemplate ? 'Update Template' : 'Save Template'}
                </button>
                <button
                  onClick={() => { setShowEditor(false); resetForm(); }}
                  className="px-3 py-2 border border-gray-med rounded font-body font-medium text-gray-dark hover:border-body"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates List */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded p-3 text-center border border-gray-med">
            <FileText className="w-12 h-12 text-gray-med mx-auto mb-4" />
            <h2 className="font-heading text-xl text-gray-dark mb-2">No templates yet</h2>
            <p className="font-body text-gray-dark mb-4">Create your first email template to get started.</p>
            <button onClick={openNew} className="text-gold hover:text-gold-light font-body text-sm font-medium">
              Create Template →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map(template => (
              <div
                key={template.id}
                className="bg-white rounded border border-gray-med p-5 hover:border-body transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-body font-medium text-body">{template.name}</h3>
                    <p className="font-body text-sm text-gray-dark mt-1 truncate">
                      Subject: {template.subject}
                    </p>
                    <p className="font-body text-xs text-gray-dark mt-2 line-clamp-2">
                      {template.body.substring(0, 150)}...
                    </p>
                    <span className="inline-block mt-2 px-2 py-0.5 bg-gray-light text-gray-dark text-xs font-body font-medium rounded capitalize">
                      {(template.category || 'general').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(template)}
                      className="p-2 text-gray-dark hover:text-body hover:bg-gray-light rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-gray-dark hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/email/compose?template=${template.id}`}
                      className="text-gold hover:text-gold-light font-body text-sm font-medium whitespace-nowrap"
                    >
                      Use →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
