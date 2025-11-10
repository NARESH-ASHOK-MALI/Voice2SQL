import { useState, useCallback } from 'react';

type QueryResult = Record<string, any>;

function App() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [query, setQuery] = useState<string>('');
	const [results, setResults] = useState<QueryResult[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [sqlQuery, setSqlQuery] = useState<string>('');
	const [isListening, setIsListening] = useState<boolean>(false);

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files) {
			setSelectedFile(event.target.files[0]);
		}
	};

	const handleUpload = useCallback(async () => {
		if (!selectedFile) {
			setError('Please select a file first.');
			return;
		}
		setIsLoading(true);
		setError(null);
		const formData = new FormData();
		formData.append('files', selectedFile);

		try {
			const response = await fetch('http://localhost:3000/api/upload', {
				method: 'POST',
				body: formData,
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Upload failed');
			}
			alert(`File uploaded successfully! Inferred tables: ${JSON.stringify(data.tables)}`);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	}, [selectedFile]);

	const handleListen = () => {
		const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		if (!SpeechRecognition) {
			setError("Sorry, your browser does not support speech recognition.");
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.continuous = false;
		recognition.lang = 'en-US';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;

		setIsListening(true);
		setError(null);

		recognition.onresult = (event: any) => {
			const speechToText = event.results[0][0].transcript;
			setQuery(speechToText);
		};

		recognition.onerror = (event: any) => {
			setError(`Speech recognition error: ${event.error}`);
		};

		recognition.onend = () => {
			setIsListening(false);
		};

		recognition.start();
	};

	const handleQuery = useCallback(async () => {
		if (!query) {
			setError('Please enter a query.');
			return;
		}
		setIsLoading(true);
		setError(null);
		setResults([]);
		setSqlQuery('');

		try {
			const response = await fetch('http://localhost:3000/api/query', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ query: query }),
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Query failed');
			}
			setResults(data.rows);
			setSqlQuery(data.sql);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	}, [query]);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
			{/* Background Pattern */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)] opacity-30"></div>
			
			<div className="relative z-10 flex flex-col items-center px-4 py-8 md:px-8 lg:px-12">
				{/* Header */}
				<div className="text-center mb-8 md:mb-12">
					<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-4 tracking-tight">
						Voice2SQL++
					</h1>
					<p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
						Transform unstructured data into insights with natural language queries
					</p>
				</div>

				{/* Upload Section */}
				<div className="w-full max-w-4xl mb-6 md:mb-8">
					<div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
						<div className="flex items-center gap-3 mb-6">
							<div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
								<span className="text-blue-400 font-bold text-sm">1</span>
							</div>
							<h2 className="text-xl md:text-2xl font-semibold text-slate-100">Upload Data File</h2>
						</div>
						
						<div className="flex flex-col sm:flex-row gap-4">
							<div className="flex-1">
								<input
									type="file"
									aria-label="Upload data file"
									onChange={handleFileChange}
									className="w-full p-4 bg-slate-700/50 backdrop-blur-sm rounded-xl border border-slate-600/50 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 hover:bg-slate-700/70"
								/>
							</div>
							<button
								onClick={handleUpload}
								disabled={isLoading || !selectedFile}
								className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 rounded-xl font-semibold text-white shadow-lg hover:shadow-blue-500/25 disabled:shadow-none transition-all duration-200 hover:scale-105 active:scale-95 active:shadow-[0_0_25px_theme(colors.blue.500)] disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isLoading ? (
									<div className="flex items-center gap-2">
										<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
										<span>Uploading...</span>
									</div>
								) : (
									'Upload'
								)}
							</button>
						</div>
					</div>
				</div>

				{/* Query Section */}
				<div className="w-full max-w-4xl mb-6 md:mb-8">
					<div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl hover:shadow-purple-500/10 transition-all duration-300">
						<div className="flex items-center gap-3 mb-6">
							<div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
								<span className="text-purple-400 font-bold text-sm">2</span>
							</div>
							<h2 className="text-xl md:text-2xl font-semibold text-slate-100">Ask a Question</h2>
						</div>
						
						<div className="flex flex-col sm:flex-row gap-4">
							<div className="flex-1">
								<input
									type="text"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder="e.g., 'show me the names of students in Computer Science'"
									className="w-full p-4 bg-slate-700/50 backdrop-blur-sm rounded-xl border border-slate-600/50 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 hover:bg-slate-700/70"
								/>
							</div>
							<div className="flex gap-3">
								<button
									onClick={handleListen}
									disabled={isLoading}
									aria-label="Start voice input"
									className={`px-6 py-4 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
										isListening 
											? 'bg-gradient-to-r from-red-600 to-red-700 animate-pulse shadow-red-500/25' 
											: 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 hover:shadow-purple-500/25'
									} active:shadow-[0_0_25px_theme(colors.purple.500)]`}
								>
									🎤
								</button>
								<button
									onClick={handleQuery}
									disabled={isLoading || !query}
									className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:from-slate-600 disabled:to-slate-700 rounded-xl font-semibold text-white shadow-lg hover:shadow-emerald-500/25 disabled:shadow-none transition-all duration-200 hover:scale-105 active:scale-95 active:shadow-[0_0_25px_theme(colors.emerald.500)] disabled:cursor-not-allowed disabled:opacity-50"
								>
									{isLoading ? (
										<div className="flex items-center gap-2">
											<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
											<span>Querying...</span>
										</div>
									) : (
										'Ask'
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
				
				{/* Status Messages */}
				{isLoading && (
					<div className="w-full max-w-4xl mb-6">
						<div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-4 shadow-lg">
							<div className="flex items-center gap-3 text-amber-400">
								<div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin"></div>
								<span className="font-medium">Processing your request...</span>
							</div>
						</div>
					</div>
				)}
				
				{error && (
					<div className="w-full max-w-4xl mb-6">
						<div className="bg-red-900/50 backdrop-blur-lg border border-red-700/50 rounded-xl p-4 shadow-lg">
							<div className="flex items-center gap-3 text-red-300">
								<div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
									<span className="text-white text-xs font-bold">!</span>
								</div>
								<span className="font-medium">Error: {error}</span>
							</div>
						</div>
					</div>
				)}

				{/* Results Section */}
				{results.length > 0 && (
					<div className="w-full max-w-6xl">
						<div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300">
							<div className="flex items-center gap-3 mb-6">
								<div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
									<span className="text-emerald-400 font-bold text-sm">✓</span>
								</div>
								<h3 className="text-xl md:text-2xl font-semibold text-slate-100">Query Results</h3>
							</div>
							
							<div className="mb-6">
								<div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 border border-slate-600/30">
									<p className="text-sm text-slate-300 font-mono break-all">
										<span className="text-slate-400">Generated SQL:</span> {sqlQuery}
									</p>
								</div>
							</div>
							
							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse">
									<thead>
										<tr className="bg-slate-700/50 backdrop-blur-sm">
											{Object.keys(results[0]).map((key) => (
												<th key={key} className="p-4 border-b border-slate-600/50 text-slate-200 font-semibold">
													{key}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{results.map((row, rowIndex) => (
											<tr key={rowIndex} className="hover:bg-slate-700/30 transition-colors duration-200">
												{Object.values(row).map((value, colIndex) => (
													<td key={colIndex} className="p-4 border-b border-slate-600/30 text-slate-300">
														{String(value)}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default App;