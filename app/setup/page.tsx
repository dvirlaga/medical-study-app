'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist' as any);

  // pdfjs-dist v3 uses plain .js worker — works in all browsers including Safari
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= (pdf as any).numPages; i++) {
    const page = await (pdf as any).getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as any[])
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n').trim();
}

export default function SetupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      // Step 1: Extract text from PDF in the browser
      setStep('📄 קורא את ה-PDF...');
      const text = await extractTextFromPDF(file);

      if (!text || text.length < 100) {
        throw new Error('לא הצלחתי לקרוא טקסט מה-PDF. ייתכן שהוא סרוק כתמונה בלבד.');
      }

      // Step 2: Send text to server
      setStep('🤖 Claude מנתח את החומר ובונה תוכנית לימודים...');
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error('הבקשה ארכה זמן רב מדי. נסה שוב.');
      }

      if (!res.ok) {
        throw new Error(data?.error ?? 'Something went wrong');
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
      setStep('');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-900">Medical Study Planner</h1>
          <p className="text-gray-500 mt-2">העלה את חומר הלימוד שלך</p>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <strong>תקופת הלימוד:</strong> 5 אפריל – 21 מאי 2026 (47 ימים)
          <br />
          Claude יחלק את החומר אוטומטית על פני כל הימים.
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              קובץ לימוד (PDF)
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
                  <p className="text-gray-600">לחץ לבחירת PDF</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm" dir="rtl">
              {error}
            </div>
          )}

          {loading && (
            <div className="bg-indigo-50 rounded-lg p-4 text-center">
              <div className="animate-spin text-2xl mb-2">⚙️</div>
              <p className="text-indigo-700 font-medium" dir="rtl">{step}</p>
              <p className="text-indigo-500 text-sm mt-1">זה עשוי לקחת עד דקה...</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'מעבד...' : '🚀 צור תוכנית לימודים'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          הטקסט מנותח על ידי Claude AI ואינו נשמר לצמיתות.
        </p>
      </div>
    </div>
  );
}
