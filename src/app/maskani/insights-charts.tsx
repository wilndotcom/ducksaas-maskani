'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'

export type TrendPoint = { label: string; value: number; current: boolean }

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export function CollectionChart({ data, currency }: { data: TrendPoint[]; currency: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-white/10" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
          <YAxis tickLine={false} axisLine={false} width={0} tick={false} />
          <Tooltip
            cursor={{ fill: 'currentColor', className: 'text-slate-100/5 dark:text-white/5' }}
            formatter={(v) => [fmt(Number(v), currency), 'Collected']}
            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(148,163,184,0.3)', fontSize: '12px' }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.current ? 'url(#collectionGrad)' : 'rgba(100,116,139,0.35)'} />
            ))}
          </Bar>
          <defs>
            <linearGradient id="collectionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OccupancyDonut({ occupied, vacant, total }: { occupied: number; vacant: number; total: number }) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0
  const data = [
    { name: 'Occupied', value: occupied },
    { name: 'Vacant', value: vacant },
  ]
  return (
    <div className="relative mx-auto h-36 w-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="72%" outerRadius="100%" paddingAngle={3} cornerRadius={6} strokeWidth={0}>
            <Cell fill="#10b981" />
            <Cell fill="rgba(148,163,184,0.3)" />
          </Pie>
          <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{pct}%</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">occupied</span>
      </div>
    </div>
  )
}
