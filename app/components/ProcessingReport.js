'use client';

import { useState } from 'react';

const STEP_ICONS = {
  success: (
    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

function DetailItem({ label, value, highlight }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-indigo-600' : 'text-gray-800'}`}>
        {typeof value === 'number' ? value.toLocaleString('id-ID') : String(value)}
      </p>
    </div>
  );
}

function StepCard({ step, index }) {
  const [expanded, setExpanded] = useState(step.status === 'error');
  const d = step.details || {};

  return (
    <div className={`border rounded-xl overflow-hidden ${
      step.status === 'error' ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500">
            {index + 1}
          </span>
          {STEP_ICONS[step.status]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{step.name}</p>
          {step.message && (
            <p className="text-xs text-red-500 truncate mt-0.5">{step.message}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {d.sheet && <DetailItem label="Sheet" value={d.sheet} />}
            {d.totalRows !== undefined && <DetailItem label="Total Baris" value={d.totalRows} />}
            {d.headerRow !== undefined && <DetailItem label="Baris Header" value={d.headerRow} />}
            {d.dataStartRow !== undefined && <DetailItem label="Data Mulai" value={d.dataStartRow} />}
            {d.todayDate && <DetailItem label="Tanggal Hari Ini" value={d.todayDate} />}
            {d.updated !== undefined && <DetailItem label="Diupdate" value={d.updated} highlight />}
            {d.skipped !== undefined && <DetailItem label="Dilewati" value={d.skipped} />}
            {d.passedCount !== undefined && <DetailItem label="PO Lolos" value={d.passedCount} highlight />}
            {d.rejectedCount !== undefined && <DetailItem label="PO Ditolak" value={d.rejectedCount} />}
            {d.matchedCount !== undefined && <DetailItem label="PO Cocok (diupdate)" value={d.matchedCount} highlight />}
            {d.unmatchedCount !== undefined && <DetailItem label="PO Tidak Cocok" value={d.unmatchedCount} />}
          </div>

          {d.sampleRejected && d.sampleRejected.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-red-600 mb-1.5">Contoh PO# yang Ditolak:</p>
              <div className="flex flex-wrap gap-1.5">
                {d.sampleRejected.map((po, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-md font-mono">
                    {po}
                  </span>
                ))}
                {d.rejectedCount > d.sampleRejected.length && (
                  <span className="text-xs text-gray-400 self-center">...dan {d.rejectedCount - d.sampleRejected.length} lainnya</span>
                )}
              </div>
            </div>
          )}

          {d.sampleMatched && d.sampleMatched.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-emerald-600 mb-1.5">Contoh PO# yang Cocok:</p>
              <div className="flex flex-wrap gap-1.5">
                {d.sampleMatched.map((po, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-md font-mono">
                    {po}
                  </span>
                ))}
                {d.matchedCount > d.sampleMatched.length && (
                  <span className="text-xs text-gray-400 self-center">...dan {d.matchedCount - d.sampleMatched.length} lainnya</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProcessingReport({ report, warnings }) {
  if (!report || !report.steps || report.steps.length === 0) return null;

  const allSuccess = report.steps.every(s => s.status === 'success');

  return (
    <div className="mt-6 space-y-4">
      {/* Header */}
      <div className={`p-4 rounded-xl border ${
        allSuccess ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          {allSuccess ? (
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <span className="text-sm font-bold text-gray-800">
            Laporan Pemrosesan &mdash; {allSuccess ? 'Semua Langkah Berhasil' : 'Ada Kesalahan'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {report.steps.length} langkah dieksekusi &middot; {allSuccess ? 'Semua berhasil' : `${report.steps.filter(s => s.status === 'error').length} langkah gagal`}
        </p>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            {STEP_ICONS.warning}
            <span className="text-xs font-bold text-amber-700">Peringatan</span>
          </div>
          <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {report.steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} />
        ))}
      </div>

      {/* Summary */}
      {report.summary && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ringkasan Output</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {report.summary.outputFile && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">File</p>
                <p className="font-bold text-gray-800">{report.summary.outputFile}</p>
              </div>
            )}
            {report.summary.outputSizeKB && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Ukuran</p>
                <p className="font-bold text-gray-800">{report.summary.outputSizeKB} KB</p>
              </div>
            )}
            {report.summary.todayDate && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Tanggal</p>
                <p className="font-bold text-gray-800">{report.summary.todayDate}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
