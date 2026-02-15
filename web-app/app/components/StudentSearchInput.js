'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * StudentSearchInput — Autocomplete search for tagging students.
 * Features: debounce 300ms, keyboard navigation, removable chips, manual add button.
 */
export default function StudentSearchInput({ selectedStudents, onStudentsChange }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const debounceRef = useRef(null);

    const search = useCallback(async (q) => {
        if (q.length < 3) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/student/search?q=${encodeURIComponent(q)}`);
            const json = await res.json();
            if (json.success && json.data) {
                // Filter out already-selected students
                const selectedCodes = new Set(selectedStudents.map(s => s.user_code));
                const filtered = json.data.filter(s => !selectedCodes.has(s.user_code));
                setResults(filtered);
                setIsOpen(filtered.length > 0);
                setHighlightIndex(-1);
            }
        } catch (err) {
            console.error('Student search error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedStudents]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.length < 3) {
            setResults([]);
            setIsOpen(false);
            return;
        }
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => clearTimeout(debounceRef.current);
    }, [query, search]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSelect = (student) => {
        onStudentsChange([...selectedStudents, student]);
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleRemove = (userCode) => {
        onStudentsChange(selectedStudents.filter(s => s.user_code !== userCode));
    };

    // Manual add: user types a student code and clicks "เพิ่ม"
    const handleManualAdd = () => {
        const trimmed = query.trim();
        if (trimmed.length < 3) return;

        // Check if already selected
        if (selectedStudents.some(s => s.user_code === trimmed)) return;

        // Check if exists in search results (prefer that data)
        const fromResults = results.find(r => r.user_code === trimmed);
        if (fromResults) {
            handleSelect(fromResults);
            return;
        }

        // Add as placeholder (name will be filled when that student logs in)
        onStudentsChange([...selectedStudents, {
            user_code: trimmed,
            name_th: null,
            name_en: null,
            avatar_url: null,
        }]);
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (!isOpen || results.length === 0) {
            // Backspace removes last chip
            if (e.key === 'Backspace' && query === '' && selectedStudents.length > 0) {
                handleRemove(selectedStudents[selectedStudents.length - 1].user_code);
            }
            // Enter adds manually when no dropdown
            if (e.key === 'Enter' && query.trim().length >= 3) {
                e.preventDefault();
                handleManualAdd();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightIndex(prev => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightIndex >= 0 && highlightIndex < results.length) {
                    handleSelect(results[highlightIndex]);
                } else {
                    handleManualAdd();
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    return (
        <div className="relative">
            {/* Selected chips */}
            {selectedStudents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedStudents.map((s) => (
                        <span
                            key={s.user_code}
                            className="inline-flex items-center gap-1 bg-[#ff5722]/20 text-[#ff5722] border border-[#ff5722]/30 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        >
                            {s.avatar_url && (
                                <img src={s.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                            )}
                            {s.name_th || s.name_en || s.user_code}
                            <button
                                type="button"
                                onClick={() => handleRemove(s.user_code)}
                                className="ml-0.5 text-[#ff5722]/60 hover:text-white transition-colors"
                                aria-label={`Remove ${s.name_th || s.user_code}`}
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Search input with Add button */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => results.length > 0 && setIsOpen(true)}
                        className="w-full bg-transparent text-white/90 focus:outline-none placeholder-white/30 text-sm font-light"
                        placeholder="พิมพ์ชื่อหรือรหัสนักศึกษา..."
                        autoComplete="off"
                        aria-label="Search students by name or code"
                    />
                    {loading && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-[#ff5722] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                        </div>
                    )}
                </div>
                {/* Manual Add Button */}
                <button
                    type="button"
                    onClick={handleManualAdd}
                    disabled={query.trim().length < 3}
                    className="px-3 py-1 bg-[#ff5722]/20 hover:bg-[#ff5722] text-[#ff5722] hover:text-white border border-[#ff5722]/30 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label="Add student"
                >
                    + เพิ่ม
                </button>
            </div>

            {/* Dropdown results */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[240px] overflow-y-auto"
                    role="listbox"
                    aria-label="Search results"
                >
                    {results.map((student, idx) => (
                        <button
                            key={student.user_code}
                            type="button"
                            role="option"
                            aria-selected={idx === highlightIndex}
                            onClick={() => handleSelect(student)}
                            onMouseEnter={() => setHighlightIndex(idx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                idx === highlightIndex
                                    ? 'bg-[#ff5722]/20 text-white'
                                    : 'text-white/80 hover:bg-white/5'
                            }`}
                        >
                            {student.avatar_url ? (
                                <img src={student.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs text-white/70">👤</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                    {student.name_th || student.name_en || 'Unknown'}
                                </div>
                                {student.name_en && student.name_th && (
                                    <div className="text-xs text-white/60 truncate">{student.name_en}</div>
                                )}
                            </div>
                            <span className="text-xs text-white/50 font-mono flex-shrink-0">
                                {student.user_code}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
