'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'idle' | 'uploading' | 'generating'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      setStep('uploading');
      const formData = new FormData();
      formData.append('pdf', file);

      setStep('generating');
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong');
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
      setStep('idle');
    }
  }

  const stepMessages: Record<string, string> = {
    uploading: '⬆️ Uploading PDF...',
    generating: '🤖 Claude is analyzing your material and building a 47-day study plan...',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-900">Medical Study Planner</h1>
          <p className="text-gray-500 mt-2">Upload your study material to get started</p>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <strong>Study Period:</strong> April 5 – May 21, 2026 (47 days)
          <br />
          Claude will divide your material across all 47 days automatically.
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Study Material (PDF)
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <p className="font-medium text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">📁</div>
                  <p className="text-gray-600">Click to select PDF</p>
                  <p className="text-sm text-gray-400 mt-1">Max recommended: 50 MB</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="bg-indigo-50 rounded-lg p-4 text-center">
              <div className="animate-spin text-2xl mb-2">⚙️</div>
              <p className="text-indigo-700 font-medium">{stepMessages[step]}</p>
              <p className="text-indigo-500 text-sm mt-1">
                This may take up to 2 minutes for large PDFs. Please wait…
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Generating…' : '🚀 Generate Study Plan'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your PDF is analyzed by Claude AI and is not stored permanently.
        </p>
      </div>
    </div>
  );
}
