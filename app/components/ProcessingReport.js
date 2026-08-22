'use client';

import { useState } from 'react';

const STEP_ICONS = {
  success: (
    <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-3.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

/* ── Detail pill ── */
function DetailItem({ label, value, highlight }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-indigo-600' : 'text-gray-800'}`}>
        {typeof value === 'number' ? value.toLocaleString('id-ID') : String(value)}
      </p>
    </div>
  );
}

/* ── Step card ── */
function StepCard({ step, index }) {
  const [expanded, setExpanded] = useState(step.status === 'error');
  const d = step.details || {};

  return (
    <div className={`border rounded-xl overflow-hidden ${
      step.status === 'error' ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/50 transition-colors"
      >
        {/* Step number + icon */}
        <div className="flex items-center gap-2.5 w-10 shrink-0">
          <span
            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold leading-none transition-colors ${
              step.status === 'success'
                ? 'bg-emerald-50 text-emerald-600'
                : step.status === 'error'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            {index + 1}
          </span>
          {STEP_ICONS[step.status]}
        </div>

        {/* Title + message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{step.name}</p>
          {step.message && (
            <p className="text-xs text-red-500 truncate mt-0.5">{step.message}</p>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 animate-fade-up">
          {/* Detail grid */}
          {Object.keys(d).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
              {d.sheet && <DetailItem label="Sheet" value={d.sheet} />}
              {d.totalRows !== undefined && <DetailItem label="Total Baris" value={d.totalRows} />}
              {d.headerRow !== undefined && <DetailItem label="Baris Header" value={d.headerRow} />}
              {d.dataStartRow !== undefined && <DetailItem label="Data Mulai" value={d.dataStartRow} />}
              {d.todayDate && <DetailItem label="Tanggal Hari Ini" value={d.todayDate} />}
              {d.updated !== undefined && <DetailItem label="Diupdate" value={d.updated} highlight />}
              {d.skipped !== undefined && <DetailItem label="Dilewati" value={d.skipped} />}
              {d.passedCount !== undefined && <DetailItem label="PO Lolos" value={d.passedCount} highlight />}
              {d.rejectedCount !== undefined && <DetailItem label="PO Ditolak" value={d.rejectedCount} />}
              {d.matchedCount !== undefined && <DetailItem label="PO Cocok" value={d.matchedCount} highlight />}
              {d.unmatchedCount !== undefined && <DetailItem label="PO Tidak Cocok" value={d.unmatchedCount} />}
            </div>
          )}

          {/* Sample PO rejected */}
          {d.sampleRejected && d.sampleRejected.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs font-semibold text-red-600 mb-1.5">Contoh PO# yang Ditolak:</p>
              <div className="flex flex-wrap gap-1.5">
                {d.sampleRejected.map((po, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-md font-mono border border-red-200"
                  >
                    {po}
                  </span>
                ))}
                {d.rejectedCount > d.sampleRejected.length && (
                  <span className="text-xs text-gray-400 self-center">
                    +{d.rejectedCount - d.sampleRejected.length} lainnya
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sample PO matched */}
          {d.sampleMatched && d.sampleMatched.length > 0 && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-600 mb-1.5">Contoh PO# yang Cocok:</p>
              <div className="flex flex-wrap gap-1.5">
                {d.sampleMatched.map((po, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-md font-mono border border-emerald-200"
                  >
                    {po}
                  </span>
                ))}
                {d.matchedCount > d.sampleMatched.length && (
                  <span className="text-xs text-gray-400 self-center">
                    +{d.matchedCount - d.sampleMatched.length} lainnya
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main report ── */
export default function ProcessingReport({ report, warnings }) {
  if (!report || !report.steps || report.steps.length === 0) return null;

  const allSuccess = report.steps.every((s) => s.status === 'success');

  return (
    <div className="mt-6 space-y-4">
      {/* ── Report header ── */}
      <div className={`p-4 rounded-xl border ${
        allSuccess ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
      }`}>
        <div className="flex items-center gap-2.5">
          {allSuccess ? (
            <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <div>
            <span className="text-sm font-bold text-gray-800">
              Laporan Pemrosesan —{' '}
              {allSuccess ? 'Semua Langkah Berhasil' : 'Ada Kesalahan'}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              {report.steps.length} langkah dieksekusi ·{' '}
              {allSuccess
                ? 'Semua berhasil'
                : `${report.steps.filter((s) => s.status === 'error').length} langkah gagal`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Warnings ── */}
      {warnings && warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            {STEP_ICONS.warning}
            <span className="text-xs font-bold text-amber-700">Peringatan</span>
          </div>
          <ul className="text-xs text-amber-600 space-y-1.5 list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i} className="pl-1">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Step cards ── */}
      <div className="space-y-3">
        {report.steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} />
        ))}
      </div>

      {/* ── Summary ── */}
      {report.summary && (
        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Ringkasan Output</h4>
            <span className="text-[10px] text-gray-400">Hasil akhir pemrosesan</span>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {report.summary.outputFile && (
                <div className="metric">
                  <p className="metric-label">File</p>
                  <p className="metric-value">{report.summary.outputFile}</p>
                </div>
              )}
              {report.summary.outputSizeKB && (
                <div className="metric">
                  <p className="metric-label">Ukuran</p>
                  <p className="metric-value">{report.summary.outputSizeKB} KB</p>
                </div>
              )}
              {report.summary.todayDate && (
                <div className="metric">
                  <p className="metric-label">Tanggal</p>
                  <p className="metric-value">{report.summary.todayDate}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
