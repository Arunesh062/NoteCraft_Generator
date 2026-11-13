export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://notecraft-backend-4ktk.onrender.com';

export interface BackendStatus {
  online: boolean;
  message: string;
  baseUrl: string;
}

export interface UploadChunkParams {
  audioBlob: Blob;
  sessionId: string;
  chunkIndex: number;
  mode?: string;
  participants?: string[];
  speakerTimeline?: any[];
}

export interface FinalizeSessionParams {
  sessionId: string;
  mode?: string;
  participants?: string[];
  speakerTimeline?: any[];
}

export interface SessionStatusResult {
  session_id: string;
  status: 'processing' | 'ready' | 'failed' | 'completed' | string;
  pdf_url?: string | null;
  docx_url?: string | null;
  notes_data?: any | null;
}

export const checkBackendHealth = async (): Promise<BackendStatus> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      return {
        online: true,
        message: data?.status || 'Backend operational',
        baseUrl: API_BASE_URL,
      };
    }
    return {
      online: false,
      message: `HTTP ${response.status}`,
      baseUrl: API_BASE_URL,
    };
  } catch (error: any) {
    return {
      online: false,
      message: error?.name === 'AbortError' ? 'Timeout' : 'Disconnected',
      baseUrl: API_BASE_URL,
    };
  }
};

export const uploadChunkToBackend = async (
  params: UploadChunkParams,
  maxRetries = 3
): Promise<{ ok: boolean; message?: string; error?: string }> => {
  const formData = new FormData();
  formData.append('audio', params.audioBlob, `chunk_${params.chunkIndex}.webm`);
  formData.append('session_id', params.sessionId);
  formData.append('chunk_index', params.chunkIndex.toString());
  formData.append('speaker_timeline', JSON.stringify(params.speakerTimeline || []));
  formData.append('participants', JSON.stringify(params.participants || []));
  formData.append('mode', params.mode || 'mom');

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      console.log(`[API] Uploading chunk ${params.chunkIndex} for session ${params.sessionId} (attempt ${attempt + 1})...`);
      const response = await fetch(`${API_BASE_URL}/upload-chunk`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({ message: 'Chunk uploaded' }));
        console.log(`[API] Chunk ${params.chunkIndex} uploaded successfully.`, data);
        return { ok: true, message: data.message };
      }
      const errorText = await response.text().catch(() => '');
      console.warn(`[API] Upload chunk ${params.chunkIndex} failed (HTTP ${response.status}):`, errorText);
      attempt++;
      if (attempt >= maxRetries) {
        return { ok: false, error: `Upload HTTP ${response.status}: ${errorText || 'Server error'}` };
      }
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    } catch (err: any) {
      console.warn(`[API] Network error uploading chunk ${params.chunkIndex}:`, err);
      attempt++;
      if (attempt >= maxRetries) {
        return { ok: false, error: err.message || 'Network error uploading audio chunk' };
      }
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  return { ok: false, error: 'Failed to upload audio chunk after multiple retries' };
};

export const finalizeSessionOnBackend = async (
  params: FinalizeSessionParams
): Promise<{ ok: boolean; message?: string; error?: string }> => {
  try {
    console.log(`[API] Finalizing session ${params.sessionId} on backend...`);
    const response = await fetch(`${API_BASE_URL}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: params.sessionId,
        mode: params.mode || 'mom',
        participants: params.participants || [],
        speaker_timeline: params.speakerTimeline || [],
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({ message: 'Finalization started' }));
      console.log(`[API] Finalization triggered successfully:`, data);
      return { ok: true, message: data.message };
    }
    const errorText = await response.text().catch(() => '');
    console.error(`[API] Finalize error (HTTP ${response.status}):`, errorText);
    return { ok: false, error: `Finalize HTTP ${response.status}: ${errorText || 'Server error'}` };
  } catch (err: any) {
    console.error('[API] Network error finalizing session:', err);
    return { ok: false, error: err.message || 'Network request failed' };
  }
};

export const fetchSessionStatusFromBackend = async (
  sessionId: string
): Promise<{ ok: boolean; data?: SessionStatusResult; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/status?session_id=${encodeURIComponent(sessionId)}`);
    if (response.ok) {
      const data: SessionStatusResult = await response.json();
      return { ok: true, data };
    }
    const errorText = await response.text().catch(() => '');
    return { ok: false, error: `Status check failed (HTTP ${response.status}): ${errorText}` };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error checking session status' };
  }
};
