'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, Home, Plus, Pencil, Trash2, X, Sparkles, ArrowLeft, MapPin, Layers } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { createProperty, updateProperty, deleteProperty, createUnit, updateUnit, deleteUnit } from './actions'
import { MobileNav } from '@/components/mobile-nav'

type Charge = { label: string; amount: number }
type Unit = {
  id: string
  unitNumber: string
  unitType: string | null
  floor: number | null
  monthlyRent: number
  depositAmount: number
  waterRatePerUnit: number
  extraCharges: Charge[]
  status: 'vacant' | 'occupied' | 'maintenance'
  propertyId: string
}
type Property = {
  id: string
  name: string
  location: string
  type: 'Apartment' | 'Court' | 'Commercial'
  totalUnits: number
  units: Unit[]
}

function statusBadge(status: Unit['status']) {
  if (status === 'occupied') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (status === 'maintenance') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
}

export function PropertiesManager({
  organization,
  orgQuery,
  roleLabel,
  properties,
  currency,
}: {
  organization: { id: string; name: string; status: string; tenantHost: string }
  orgQuery: string
  roleLabel: string
  properties: Property[]
  currency: string
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [propForm, setPropForm] = useState<{ open: boolean; editing: Property | null }>({ open: false, editing: null })
  const [unitForm, setUnitForm] = useState<{ open: boolean; editing: Unit | null; propertyId: string }>({ open: false, editing: null, propertyId: '' })
  const [unitCharges, setUnitCharges] = useState<Charge[]>([])
  const openUnitForm = (editing: Unit | null, propertyId: string) => {
    setUnitCharges(editing?.extraCharges?.length ? editing.extraCharges.map((c) => ({ ...c })) : [])
    setUnitForm({ open: true, editing, propertyId })
  }
  const closeUnitForm = () => { setUnitForm({ open: false, editing: null, propertyId: '' }); setUnitCharges([]) }
  const [expanded, setExpanded] = useState<string | null>(properties[0]?.id || null)

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }
  const run = (fn: () => Promise<void>, success: string, close?: () => void) => {
    startTransition(async () => {
      try { await fn(); flash(success); close?.() } catch (e) { flash(e instanceof Error ? e.message : 'Action failed') }
    })
  }

  const totals = useMemo(() => {
    const allUnits = properties.flatMap((p) => p.units)
    return {
      properties: properties.length,
      units: allUnits.length,
      occupied: allUnits.filter((u) => u.status === 'occupied').length,
      vacant: allUnits.filter((u) => u.status === 'vacant').length,
      maintenance: allUnits.filter((u) => u.status === 'maintenance').length,
    }
  }, [properties])

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units', active: true },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/notifications${orgQuery}`, label: 'Notifications' },
    { href: `/maskani/reports${orgQuery}`, label: 'Reports' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
  ]

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-600/20" />
      </div>

      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight" title={organization.name}>{organization.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1.5">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
            <a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav} title={organization.name} />
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/maskani${orgQuery}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200"><Building2 className="h-3.5 w-3.5" /> Properties & Units</p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Properties & Units</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{organization.name} · {organization.tenantHost} · Role: {roleLabel}</p>
              </div>
              <div className="flex items-center gap-3">
                {msg && <div className="rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</div>}
                <button onClick={() => setPropForm({ open: true, editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20"><Plus className="h-4 w-4" /> Add Property</button>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Properties</p><p className="mt-1 text-2xl font-bold">{totals.properties}</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Total Units</p><p className="mt-1 text-2xl font-bold">{totals.units}</p></div>
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-sm text-emerald-700 dark:text-emerald-300">Occupied</p><p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-200">{totals.occupied}</p></div>
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 dark:border-sky-500/20 dark:bg-sky-500/10"><p className="text-sm text-sky-700 dark:text-sky-300">Vacant</p><p className="mt-1 text-2xl font-bold text-sky-700 dark:text-sky-200">{totals.vacant}</p></div>
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-sm text-amber-700 dark:text-amber-300">Maintenance</p><p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-200">{totals.maintenance}</p></div>
            </div>

            {propForm.open && (
              <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{propForm.editing ? 'Edit Property' : 'Add Property'}</h3>
                  <button onClick={() => setPropForm({ open: false, editing: null })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <form action={(fd) => { fd.set('orgId', organization.id); run(() => (propForm.editing ? updateProperty(fd) : createProperty(fd)), propForm.editing ? 'Property updated' : 'Property created', () => setPropForm({ open: false, editing: null })) }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {propForm.editing && <input type="hidden" name="id" value={propForm.editing.id} />}
                  <div>
                    <label className="mb-1 block text-sm font-medium">Property name *</label>
                    <input name="name" required defaultValue={propForm.editing?.name} className={inputCls} placeholder="e.g. Sunrise Apartments" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Location *</label>
                    <input name="location" required defaultValue={propForm.editing?.location} className={inputCls} placeholder="e.g. Westlands, Nairobi" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Type *</label>
                    <select name="type" required defaultValue={propForm.editing?.type || 'Apartment'} className={inputCls}>
                      <option value="Apartment">Apartment</option>
                      <option value="Court">Court</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Total units (planned) *</label>
                    <input name="totalUnits" type="number" min={0} required defaultValue={propForm.editing?.totalUnits ?? 0} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setPropForm({ open: false, editing: null })} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button>
                    <button type="submit" disabled={pending} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">{pending ? 'Saving...' : propForm.editing ? 'Update Property' : 'Create Property'}</button>
                  </div>
                </form>
              </div>
            )}

            {unitForm.open && (
              <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{unitForm.editing ? 'Edit Unit' : 'Add Unit'}</h3>
                  <button onClick={() => closeUnitForm()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <form action={(fd) => { fd.set('orgId', organization.id); run(() => (unitForm.editing ? updateUnit(fd) : createUnit(fd)), unitForm.editing ? 'Unit updated' : 'Unit created', () => closeUnitForm()) }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {unitForm.editing && <input type="hidden" name="id" value={unitForm.editing.id} />}
                  <div>
                    <label className="mb-1 block text-sm font-medium">Property *</label>
                    <select name="propertyId" required defaultValue={unitForm.editing?.propertyId || unitForm.propertyId} className={inputCls}>
                      <option value="">Select property</option>
                      {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Unit number / name *</label>
                    <input name="unitNumber" required defaultValue={unitForm.editing?.unitNumber} className={inputCls} placeholder="e.g. A-101" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Unit type / size</label>
                    <select name="unitType" defaultValue={unitForm.editing?.unitType || ''} className={inputCls}>
                      <option value="">Select type</option>
                      <option value="Bedsitter">Bedsitter</option>
                      <option value="Studio">Studio</option>
                      <option value="1 Bedroom">1 Bedroom</option>
                      <option value="2 Bedroom">2 Bedroom</option>
                      <option value="3 Bedroom">3 Bedroom</option>
                      <option value="4+ Bedroom">4+ Bedroom</option>
                      <option value="Shop/Commercial">Shop / Commercial</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Floor</label>
                    <input name="floor" type="number" defaultValue={unitForm.editing?.floor ?? ''} className={inputCls} placeholder="e.g. 1" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Monthly rent *</label>
                    <input name="monthlyRent" type="number" min={0} step="0.01" required defaultValue={unitForm.editing?.monthlyRent ?? 0} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Deposit amount *</label>
                    <input name="depositAmount" type="number" min={0} step="0.01" required defaultValue={unitForm.editing?.depositAmount ?? 0} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Water rate / unit</label>
                    <input name="waterRatePerUnit" type="number" min={0} step="0.01" defaultValue={unitForm.editing?.waterRatePerUnit ?? 0} className={inputCls} placeholder="e.g. 0.5" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="mb-1 block text-sm font-medium">Extra monthly charges <span className="font-normal text-slate-500">(optional — e.g. internet, water retainer, parking)</span></label>
                    <input type="hidden" name="extraCharges" value={JSON.stringify(unitCharges)} />
                    <div className="space-y-2">
                      {unitCharges.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input value={c.label} onChange={(e) => setUnitCharges(unitCharges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inputCls} placeholder="Charge name e.g. Internet" />
                          <input value={c.amount} onChange={(e) => setUnitCharges(unitCharges.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))} type="number" min={0} step="0.01" className={`${inputCls} w-32`} placeholder="Amount" />
                          <button type="button" onClick={() => setUnitCharges(unitCharges.filter((_, j) => j !== i))} className="rounded-lg border border-rose-200 p-2 text-rose-500 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      {unitCharges.length < 10 && (
                        <button type="button" onClick={() => setUnitCharges([...unitCharges, { label: '', amount: 0 }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-white/15 dark:text-slate-300"><Plus className="h-3.5 w-3.5" /> Add charge</button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">These are added to the tenant&apos;s monthly invoice automatically on the billing day.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Status *</label>
                    <select name="status" required defaultValue={unitForm.editing?.status || 'vacant'} className={inputCls}>
                      <option value="vacant">Vacant</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
                    <button type="button" onClick={() => closeUnitForm()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button>
                    <button type="submit" disabled={pending} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">{pending ? 'Saving...' : unitForm.editing ? 'Update Unit' : 'Create Unit'}</button>
                  </div>
                </form>
              </div>
            )}

            {properties.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-10 text-center shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg"><Building2 className="h-8 w-8" /></div>
                <h3 className="text-xl font-bold">No properties yet</h3>
                <p className="mx-auto mt-2 max-w-xl text-slate-600 dark:text-slate-400">Add your first property, then create units with rent, deposit, and occupancy status.</p>
                <button onClick={() => setPropForm({ open: true, editing: null })} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Property</button>
              </div>
            ) : (
              <div className="space-y-5">
                {properties.map((p) => {
                  const open = expanded === p.id
                  return (
                    <div key={p.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                        <button onClick={() => setExpanded(open ? null : p.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg"><Building2 className="h-6 w-6" /></div>
                          <div className="min-w-0">
                            <p className="truncate text-lg font-semibold">{p.name}</p>
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.location}</span>
                              <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {p.type}</span>
                              <span>{p.units.length} / {p.totalUnits} units added</span>
                            </p>
                          </div>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => openUnitForm(null, p.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/60 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"><Plus className="h-4 w-4" /> Add Unit</button>
                          <button onClick={() => setPropForm({ open: true, editing: p })} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" title="Edit property"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => { if (confirm(`Delete property "${p.name}" and all its units?`)) { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', p.id); run(() => deleteProperty(fd), 'Property deleted') } }} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10" title="Delete property"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      {open && (
                        <div className="border-t border-slate-200/70 px-5 pb-5 pt-4 dark:border-white/10">
                          {p.units.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">
                              No units added yet. <button onClick={() => openUnitForm(null, p.id)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">Add the first unit</button>.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-sm">
                                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  <tr className="border-b border-slate-200/70 dark:border-white/10">
                                    <th className="px-3 py-2">Unit</th>
                                    <th className="px-3 py-2">Floor</th>
                                    <th className="px-3 py-2">Monthly Rent</th>
                                    <th className="px-3 py-2">Deposit</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                                  {p.units.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5">
                                      <td className="px-3 py-3 font-medium"><span className="inline-flex items-center gap-2"><Home className="h-4 w-4 text-slate-400" /> {u.unitNumber}</span>{u.unitType && <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-normal text-slate-600 dark:text-slate-300">{u.unitType}</span>}</td>
                                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{u.floor ?? '—'}</td>
                                      <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(u.monthlyRent, currency)}</td>
                                      <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(u.depositAmount, currency)}</td>
                                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadge(u.status)}`}>{u.status}</span></td>
                                      <td className="px-3 py-3">
                                        <div className="flex justify-end gap-2">
                                          <button onClick={() => openUnitForm(u, p.id)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" title="Edit unit"><Pencil className="h-4 w-4" /></button>
                                          <button onClick={() => { if (confirm(`Delete unit "${u.unitNumber}"?`)) { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', u.id); run(() => deleteUnit(fd), 'Unit deleted') } }} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10" title="Delete unit"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
      <footer className="relative border-t border-slate-200/80 bg-white/60 px-4 py-4 text-center text-sm text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400">
        Design &amp; Develop by <span className="font-medium text-slate-800 dark:text-slate-200">Wilncom Tech</span>
      </footer>
    </div>
  )
}
