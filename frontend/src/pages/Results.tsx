import { useEffect, useState } from 'react'
import axios from 'axios'
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

type Row = Record<string, any>

export default function Results() {
  const [rows, setRows] = useState<Row[]>([])
  const [columns, setColumns] = useState<string[]>([])

  useEffect(() => {
    ;(async () => {
      const res = await axios.get('/api/results')
      const data = res.data?.rows ?? []
      setRows(data)
      setColumns(data.length ? Object.keys(data[0]) : [])
    })()
  }, [])

  const numericColumns = columns.filter(c => rows.every(r => typeof r[c] === 'number'))
  const labelColumn = columns.find(c => typeof rows[0]?.[c] === 'string')

  const chartData = labelColumn && numericColumns.length ? {
    labels: rows.map(r => r[labelColumn]),
    datasets: numericColumns.map((c, idx) => ({
      label: c,
      data: rows.map(r => r[c]),
      backgroundColor: `hsl(${(idx * 70) % 360} 80% 60%)`
    }))
  } : null

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Results</h2>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {columns.map(c => <th key={c} className="text-left px-3 py-2 border-b">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                {columns.map(c => <td key={c} className="px-3 py-2 border-b">{String(row[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chartData && (
        <div className="border rounded p-4">
          <Bar data={chartData} />
        </div>
      )}
    </div>
  )
}

