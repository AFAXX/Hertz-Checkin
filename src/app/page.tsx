'use client';

import { useState, useEffect, useRef } from 'react';
import { t, LOCALES, type Locale } from '@/lib/i18n';

interface AdminContract {
  id: string;
  contractNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string | null;
  status: string;
  createdAt: string;
  tokens: Array<{ id: string; token: string; expiresAt: string; usedAt: string | null; isExpired: boolean }>;
  photosSubmitted: number;
  photos: Array<{ key: string; label: string; fileName: string; uploadedAt: string }>;
}

interface ChecklistItem {
  id: string;
  key: string;
  label: string;
  labelEn: string | null;
  description: string | null;
  icon: string | null;
  required: boolean;
  completed: boolean;
  photoCount: number;
}

interface ValidatedContract {
  id: string;
  contractNumber: string;
  customerName: string;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string | null;
  status: string;
}

const MAX_PHOTOS = 10;

function CarDiagram({ onSelect, photoCounts }: {
  onSelect: (key: string) => void;
  photoCounts: Record<string, number>;
}) {
  const getCount = (k: string) => photoCounts[k] || 0;

  return (
    <svg viewBox="0 0 300 540" className="w-full max-w-[280px] mx-auto">
      <path d="M108 510 Q60 490 48 430 L48 110 Q48 55 108 32 L192 32 Q252 55 252 110 L252 430 Q240 490 192 510 Z"
        fill="rgba(0,0,0,0.06)" transform="translate(4,4)" />
      <path d="M108 510 Q60 490 48 430 L48 110 Q48 55 108 32 L192 32 Q252 55 252 110 L252 430 Q240 490 192 510 Z"
        fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2.5" />
      <path d="M120 430 L120 490 Q150 510 180 490 L180 430 Q150 420 120 430 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <path d="M95 390 Q150 410 205 390 L185 350 Q150 365 115 350 Z" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5" />
      <rect x="80" y="180" width="140" height="170" rx="20" fill="#e8ecf1" stroke="#b0b8c4" strokeWidth="1" />
      <path d="M95 180 Q150 160 205 180 L185 215 Q150 200 115 215 Z" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5" />
      <path d="M120 110 L120 180 Q150 170 180 180 L180 110 Q150 100 120 110 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <rect x="38" y="365" width="12" height="20" rx="4" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <rect x="250" y="365" width="12" height="20" rx="4" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <ellipse cx="100" cy="478" rx="12" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <ellipse cx="200" cy="478" rx="12" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <ellipse cx="100" cy="60" rx="10" ry="7" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5" />
      <ellipse cx="200" cy="60" rx="10" ry="7" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5" />
      <ellipse cx="62" cy="155" rx="18" ry="28" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="62" cy="155" rx="8" ry="14" fill="#64748b" />
      <ellipse cx="238" cy="155" rx="18" ry="28" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="238" cy="155" rx="8" ry="14" fill="#64748b" />
      <ellipse cx="68" cy="420" rx="18" ry="26" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="68" cy="420" rx="8" ry="13" fill="#64748b" />
      <ellipse cx="232" cy="420" rx="18" ry="26" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="232" cy="420" rx="8" ry="13" fill="#64748b" />

      <g onClick={() => onSelect('front')} style={{ cursor: 'pointer' }}>
        <rect x="90" y="435" width="120" height="60" rx="10" fill={getCount('front') > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.05)'} stroke={getCount('front') > 0 ? '#22c55e' : '#94a3b8'} strokeWidth="1.5" strokeDasharray={getCount('front') > 0 ? 'none' : '5 3'} />
        {getCount('front') > 0 && <><circle cx="200" cy="445" r="9" fill="#22c55e" /><text x="200" y="449" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{getCount('front')}</text></>}
      </g>
      <g onClick={() => onSelect('back')} style={{ cursor: 'pointer' }}>
        <rect x="90" y="75" width="120" height="60" rx="10" fill={getCount('back') > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.05)'} stroke={getCount('back') > 0 ? '#22c55e' : '#94a3b8'} strokeWidth="1.5" strokeDasharray={getCount('back') > 0 ? 'none' : '5 3'} />
        {getCount('back') > 0 && <><circle cx="200" cy="85" r="9" fill="#22c55e" /><text x="200" y="89" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{getCount('back')}</text></>}
      </g>
      <g onClick={() => onSelect('passenger_side')} style={{ cursor: 'poi
