export default function Home() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Welcome</h2>
      <p className="text-gray-700">Upload files, infer schema, and query with natural language or voice.</p>
      <ul className="list-disc pl-6 text-gray-700">
        <li>Supported uploads: PDF, CSV, JSON, TXT</li>
        <li>Query with text or microphone</li>
        <li>See tabular and chart results</li>
      </ul>
    </div>
  )
}

