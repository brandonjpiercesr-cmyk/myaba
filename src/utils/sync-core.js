// ⬡B:MACE.core:CORE:sync_core:20260413⬡
// SEED/ABA Sync Shared Core — Onboarding for New HAMs

import { useState, useCallback } from "react";

export async function generateQuestionnaire(api, hamId) {
  return await api(`/api/seed/generate/${hamId}`);
}

export async function uploadResponse(api, userId, responseText) {
  return await api('/api/seed/upload', { method: 'POST', body: { user_id: userId, response_text: responseText } });
}

export async function checkStatus(api, hamId) {
  return await api(`/api/seed/status/${hamId}`);
}

export function useOnboarding(api, userId) {
  const [questionnaire, setQuestionnaire] = useState(null);
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState('generate'); // generate, download, upload, processing, complete

  const generate = useCallback(async () => {
    try {
      const data = await generateQuestionnaire(api, userId);
      setQuestionnaire(data?.questionnaire || null);
      setStep('download');
    } catch (e) { console.error('[SEED] Generate error:', e); }
  }, [api, userId]);

  const upload = useCallback(async (responseText) => {
    setUploading(true);
    try {
      await uploadResponse(api, userId, responseText);
      setStep('processing');
      // Check status after brief delay
      setTimeout(async () => {
        const s = await checkStatus(api, userId);
        setStatus(s);
        if (s?.sufficient) setStep('complete');
      }, 2000);
    } catch (e) { console.error('[SEED] Upload error:', e); }
    setUploading(false);
  }, [api, userId]);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await checkStatus(api, userId);
      setStatus(s);
    } catch (e) { /* ok */ }
  }, [api, userId]);

  return { questionnaire, status, uploading, step, generate, upload, refreshStatus, setStep };
}
