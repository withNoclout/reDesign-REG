'use client';

import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

/**
 * ProfileUploadModal
 * A two-step modal for uploading a profile picture:
 *   Step 1 – File selection (drag & drop or click).
 *   Step 2 – Circular crop with zoom slider, preview, Cancel & Save.
 *
 * Props:
 *   isOpen   {boolean}   – Whether the modal is visible.
 *   onClose  {function}  – Called when the user cancels or closes.
 *   onSave   {function}  – Called with the cropped base64 dataUrl string.
 */
export default function ProfileUploadModal({ isOpen, onClose, onSave }) {
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [saving, setSaving] = useState(false);
    const [draggingOver, setDraggingOver] = useState(false);
    const fileInputRef = useRef(null);

    const reset = () => {
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
        setSaving(false);
        setDraggingOver(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const readFile = (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('ไฟล์ใหญ่เกินไป (สูงสุด 10 MB)');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => setImageSrc(e.target.result);
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) readFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDraggingOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) readFile(file);
    };

    const onCropComplete = useCallback((_croppedArea, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const handleSave = async () => {
        if (!croppedAreaPixels) return;
        setSaving(true);
        try {
            const dataUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
            onSave(dataUrl);
            reset();
        } catch (err) {
            console.error('Crop failed:', err);
            alert('เกิดข้อผิดพลาดในการครอบตัดรูป');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        /* Backdrop */
        <div
            id="profile-upload-modal-backdrop"
            onClick={handleClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
                animation: 'fadeInBackdrop 0.2s ease',
            }}
        >
            {/* Modal Panel */}
            <div
                id="profile-upload-modal-panel"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '420px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
                    animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    fontFamily: 'Prompt, sans-serif',
                }}
            >
                {/* Modal Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Camera Icon */}
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'rgba(99, 179, 237, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(147,210,255,1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                        </div>
                        <div>
                            <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                                {imageSrc ? 'ปรับตำแหน่งรูปภาพ' : 'อัปโหลดรูปโปรไฟล์'}
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: 0 }}>
                                {imageSrc ? 'เลื่อนหรือซูมเพื่อปรับกรอบ' : 'รองรับ JPG, PNG, WEBP (สูงสุด 10 MB)'}
                            </p>
                        </div>
                    </div>
                    <button
                        id="profile-upload-modal-close"
                        onClick={handleClose}
                        aria-label="ปิด"
                        style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '20px 24px' }}>
                    {!imageSrc ? (
                        /* ── Step 1: File Picker ── */
                        <>
                            <div
                                id="profile-upload-dropzone"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
                                onDragLeave={() => setDraggingOver(false)}
                                onDrop={handleDrop}
                                style={{
                                    border: `2px dashed ${draggingOver ? 'rgba(147,210,255,0.8)' : 'rgba(255,255,255,0.2)'}`,
                                    borderRadius: '16px',
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: draggingOver ? 'rgba(147,210,255,0.07)' : 'rgba(255,255,255,0.03)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {/* Upload Icon */}
                                <div style={{
                                    width: '56px', height: '56px', borderRadius: '16px',
                                    background: 'rgba(99,179,237,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 14px',
                                }}>
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(147,210,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="16 16 12 12 8 16" />
                                        <line x1="12" y1="12" x2="12" y2="21" />
                                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                                    </svg>
                                </div>
                                <p style={{ color: 'white', fontWeight: 600, margin: '0 0 4px', fontSize: '0.95rem' }}>
                                    คลิกหรือลากรูปมาวางที่นี่
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', margin: 0 }}>
                                    JPG, PNG, WEBP · สูงสุด 10 MB
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                            </div>

                            {/* Cancel */}
                            <button
                                id="profile-upload-cancel-btn"
                                onClick={handleClose}
                                style={{
                                    marginTop: '16px', width: '100%', height: '44px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '12px', color: 'rgba(255,255,255,0.75)',
                                    fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                                    fontFamily: 'Prompt, sans-serif',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            >
                                ยกเลิก
                            </button>
                        </>
                    ) : (
                        /* ── Step 2: Cropper ── */
                        <>
                            {/* Crop Area */}
                            <div style={{
                                position: 'relative',
                                width: '100%',
                                height: '300px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                background: '#000',
                            }}>
                                <Cropper
                                    image={imageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    cropShape="round"
                                    showGrid={false}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                    style={{
                                        containerStyle: { borderRadius: '16px' },
                                    }}
                                />
                            </div>

                            {/* Zoom Slider */}
                            <div style={{ marginTop: '16px' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginBottom: '8px',
                                }}>
                                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                            <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
                                        </svg>
                                        ซูม
                                    </span>
                                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
                                        {Math.round((zoom - 1) / 2 * 100)}%
                                    </span>
                                </div>
                                <input
                                    id="profile-upload-zoom-slider"
                                    type="range"
                                    min="1" max="3" step="0.05"
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    style={{
                                        width: '100%', accentColor: '#63b3ed',
                                        height: '4px', cursor: 'pointer',
                                    }}
                                />
                            </div>

                            {/* Back + Save Buttons */}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button
                                    id="profile-upload-back-btn"
                                    onClick={() => { setImageSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                                    style={{
                                        flex: '0 0 auto', height: '44px', padding: '0 18px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '12px', color: 'rgba(255,255,255,0.75)',
                                        fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                                        fontFamily: 'Prompt, sans-serif',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                    กลับ
                                </button>
                                <button
                                    id="profile-upload-save-btn"
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{
                                        flex: 1, height: '44px',
                                        background: saving
                                            ? 'rgba(99,179,237,0.4)'
                                            : 'linear-gradient(135deg, #63b3ed 0%, #4299e1 100%)',
                                        border: 'none', borderRadius: '12px',
                                        color: 'white', fontSize: '0.9rem', fontWeight: 600,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        fontFamily: 'Prompt, sans-serif',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        boxShadow: saving ? 'none' : '0 4px 16px rgba(66,153,225,0.35)',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.9'; }}
                                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                >
                                    {saving ? (
                                        <>
                                            <div style={{
                                                width: '16px', height: '16px', borderRadius: '50%',
                                                border: '2px solid rgba(255,255,255,0.5)',
                                                borderTopColor: 'white',
                                                animation: 'spin 0.7s linear infinite',
                                            }} />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            บันทึกรูปภาพ
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Animation + Spinner Keyframes */}
            <style>{`
                @keyframes fadeInBackdrop { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUpModal {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)     scale(1); }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
