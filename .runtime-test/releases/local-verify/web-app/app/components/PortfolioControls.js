import { motion, AnimatePresence } from 'framer-motion';

export default function PortfolioControls({
    showControls,
    onToggleControls,
    isManageMode,
    onToggleManageMode,
    settings,
    onUpdateSetting,
    onSaveSettings,
    isSaving,
    isCustomMode
}) {
    return (
        <div className="absolute -top-12 right-4 z-20 flex items-center gap-2">
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-2 flex items-center gap-4 pr-6"
                    >
                        {/* Manage Mode Toggle */}
                        <button
                            onClick={onToggleManageMode}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${isManageMode ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
                        >
                            {isManageMode ? 'Done' : 'Manage'}
                        </button>
                        <div className="w-px h-4 bg-white/20"></div>

                        {/* Mode Toggle: Fixed / Custom */}
                        <div className="flex bg-white/10 rounded-lg p-0.5">
                            <button
                                onClick={() => onUpdateSetting('mode', 'fixed')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!isCustomMode ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
                            >
                                Fixed
                            </button>
                            <button
                                onClick={() => onUpdateSetting('mode', 'custom')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${isCustomMode ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
                            >
                                Custom
                            </button>
                        </div>

                        <div className="w-px h-4 bg-white/20"></div>

                        {/* Column Slider (Only for Fixed Mode) */}
                        {!isCustomMode && (
                            <div className="flex items-center gap-2 pl-2">
                                <span className="text-xs text-white/50">Cols</span>
                                <input
                                    type="range"
                                    min="2"
                                    max="5"
                                    value={settings.fixedConfig?.columnCount || 3}
                                    onChange={(e) => onUpdateSetting('fixedConfig', { ...settings.fixedConfig, columnCount: parseInt(e.target.value) })}
                                    className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#ff5722]"
                                />
                                <span className="text-xs text-white font-bold w-3">{settings.fixedConfig?.columnCount || 3}</span>
                            </div>
                        )}

                        {/* Gap Toggle (Only for Fixed Mode) */}
                        {!isCustomMode && (
                            <>
                                <div className="w-px h-4 bg-white/20"></div>
                                <button
                                    onClick={() => onUpdateSetting('fixedConfig', { ...settings.fixedConfig, gapSize: (settings.fixedConfig?.gapSize || 'normal') === 'normal' ? 'compact' : 'normal' })}
                                    className={`text-xs font-medium transition-colors ${(settings.fixedConfig?.gapSize || 'normal') === 'compact' ? 'text-[#ff5722]' : 'text-white/60 hover:text-white'}`}
                                >
                                    {(settings.fixedConfig?.gapSize || 'normal') === 'compact' ? 'Compact' : 'Comfy'}
                                </button>
                            </>
                        )}


                        <div className="w-px h-4 bg-white/20"></div>

                        {/* Save Button */}
                        <button
                            onClick={onSaveSettings}
                            disabled={isSaving}
                            className="text-xs font-bold text-white/80 hover:text-white transition-colors"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={onToggleControls}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showControls ? 'bg-[#ff5722] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            </button>
        </div>
    );
}
