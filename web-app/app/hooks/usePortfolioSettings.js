
import { useState, useEffect, useCallback } from 'react';

export function usePortfolioSettings() {
    const [settings, setSettings] = useState({
        mode: 'fixed',
        fixedConfig: {
            columnCount: 3,
            gapSize: 'normal'
        },
        customLayout: [],
        maxItemsPerPage: 12
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load settings on mount
    useEffect(() => {
        async function loadSettings() {
            try {
                const res = await fetch('/api/user/settings');
                const json = await res.json();
                if (json.success) {
                    setSettings(prev => ({ ...prev, ...json.config }));
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadSettings();
    }, []);

    // Save settings
    const saveSettings = useCallback(async (newSettings) => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/user/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: newSettings }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);

            // Update local state to confirm save (though real-time update already did)
            setSettings(newSettings);
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('❌ Failed to save settings');
            return false;
        } finally {
            setIsSaving(false);
        }
    }, []);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return {
        settings,
        isLoading,
        isSaving,
        setIsLoading,
        updateSetting,
        saveSettings
    };
}
