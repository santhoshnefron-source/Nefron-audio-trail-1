import { GoogleGenAI } from "@google/genai";
import { collection, getDocs, getDoc, doc, setDoc, addDoc, writeBatch } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "./firebase";

export interface KeyPingResult {
  index: number;
  keyId: string;
  masked: string;
  status: 'success' | 'quota_exhausted' | 'error';
  message: string;
  latencyMs: number;
  timestamp: string;
}

export interface KeepAliveProgress {
  total: number;
  current: number;
  successCount: number;
  failCount: number;
  currentKeyMasked: string;
  currentKeyIndex: number;
  results: KeyPingResult[];
  isFinished: boolean;
  isCancelled: boolean;
  statusMessage: string;
}

export interface KeepAliveSummary {
  lastRunAt: string;
  totalKeys: number;
  successCount: number;
  failCount: number;
  durationMs?: number;
  runBy?: string;
  isCancelled?: boolean;
}

class GeminiManager {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private exhaustedKeys: Set<string> = new Set();
  private inactiveKeys: Set<string> = new Set();
  private keyLastUsed: Map<string, number> = new Map();
  private lastQuotaReset: number = Date.now();
  private readonly STORAGE_KEY = "gemini_api_rotation_index";

  constructor() {
    this.keyInit();
    
    // Restore the current rotation index from persistent storage so we don't start at 0
    // after every app refresh/cold-boot. This ensures that even with very low
    // app usage over 5 months, ALL 103 keys are cycled through.
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const storedIndex = window.localStorage.getItem(this.STORAGE_KEY);
        if (storedIndex !== null) {
          const parsed = parseInt(storedIndex, 10);
          if (!isNaN(parsed)) {
            this.currentIndex = parsed;
          }
        }
      }
    } catch (e) {
      console.warn("localStorage not available:", e);
    }
  }

  private keyInit() {
    // Priority 1: AI Studio provided key (process.env.GEMINI_API_KEY)
    // Priority 2: VITE_GEMINI_API_KEY from environment
    // Priority 3: Hardcoded fallback keys
    
    // In Vite, process.env is often polyfilled. We check carefully.
    const processKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : '';
    const viteKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
    
    // Combine both sources so that we capture all keys (e.g. 98 keys from VITE_GEMINI_API_KEY plus platform defaults)
    const combinedKeys = [processKey, viteKey].filter(Boolean).join(',');
    
    const hardcodedKeys = "AIzaSyBLCEEvVP4o3DcTnJP7uHuyeA4uQdrtqAU,AizaSyAl65aicnL6P84O_2Jvq7MUi2kVIRDFndo,AizaSyDEYx-mir9XA9efU5t7v6Gt3fvXPmqWmao,AizaSyDSHWOjOa4Xp6qXwXNgDBPnL-s7QVeIZL8,AizaSyBAcgDiGQGYBHT-hz0NrE4PLlFWGZrIX3Y,AizaSyBJ_Mgv2TZGlVWHWzidmIZJG94_9RujcII,AizaSyCNrohly1s86hVdwjkw33WGNTVUtDYiO3c,AizaSyCyUTjpxfpo_2jhq3C-ZTPwaphDh_lIdXw,AizaSyC-KRok-KJwqLMIGZX1KHOKAnkAxkJK7bw,AizaSyBYJ-ZN3nCNR6Dme8FflqSC1HFwn2qNo2A,AizaSyAVZAl6OGLWImWW0XVRV5kvIBKDeoooSqw,AizaSyDWUggj0k2ck2Jw_3vafUgKM7xOvJPWQsI,AizaSyDkh1cz2oLDTBHXU2cj-5xEtUr1PY4kCs4,AizaSyC9J8XbjPTkYGocRjDMBQdA3zM4st0Kbj0,AizaSyA6Y2BE97FUhIgCWsrko5lY6KBA0462gVQ,AizaSyCLROZoRI_oET_90LoY4Ea0q_thX1i771g,AizaSyBm29A_o9WlKr5S-K0ZlZauZ_GtSQpZOq0,AizaSyBBnm_J-OV4qbz4156axCWb3Kg203sA6b4,AizaSyDk5PFY1qcfOIxH4JwAo5FVMqqS4RaTdoE,AizaSyAT7jd1OAZQutKmtQA_CBBKx6Na-ulUp9U,AizaSyCDN840ZjcZsFDg1-u8U6TkLzScn53wh2c,AizaSyDKGzzmO4b4zRPYq70R2Cjn5sAHaQArWxo,AizaSyB9K2mitWQOb9S3COGZ_yxgAhi5L2knKKo,AizaSyBTsfN_kecZaJp1FhV8j16N1A4sTC2Et2A,AizaSyDN0YTLeaDHlXniJjgCaiYPNbLvVz68ux0,AizaSyDElef-QftY5OHIXN6zhV0Qanc_YPagY4c,AizaSyAH_bEWe46-PbYIUEj-79VNXPFBqHA0yy0,AizaSyAcE-vY-r1sYj_tBi5lfhMcJRoNTdS8gwU,AizaSyDMXzySuigRKnC-oPsyPfS7SM4kcuJEuAQ,AizaSyDfntHkSQTEgPjLUfyWT6pPHgqb9g8oOdo,AizaSyDmce18uCacAOikmCqHmatNAqS30Z7TSmQ,AizaSyDl_07fjKs_xI9_0mGPexZqS6GrHZsNr8M,AizaSyAvbXL7KID_o5YcN5TbFW0wfrrghEF__fQ,AizaSyDLhuf8fdFnrWHWfiu6J8ehl2xI8jx_KSI,AizaSyAWD27VATJ6MBCiTA6LHf_wSu-0urqbbI8,AizaSyD-a7Q_FF1_0-OXuhL7LI0zf5QbGDLUXD0,AizaSyAlTSNlfJISnR6hkUlndoLMbbP0Y3HKP78,AizaSyB9066wy8yKi8YsirT3Llzn05cER4TwWrM,AizaSyBh5B5tPwzBCgFGllH9xZmohmFpdiLTs5k,AizaSyA7wN0O3xSwTpLfxKAfRw7oulKrkfRTZHE,AizaSyAsmXWX6GHg48139r1hJ-m5uNC44al3d_w,AizaSyDU9NVryg1aK4voVaAIJn_p9PJntMqckGM,AizaSyAYfOf9RYS62FDLsRrqC-oRWXDtR_IiM5U,AizaSyBBPj2XyPMGPeiz4XEM4uukLoL7gTxBZYE,AizaSyBZdfPQ5nRnRMswb_ewHj2-kcwoPmHIKgM,AizaSyCQmIiVUyle2bRUyTNandcbreChvICwMdA,AizaSyCUCupY11JWm4P0ieeeDbxrfSwGbEc6xHQ,AizaSyBeKLiAcMI09lBz5OjtiFPTj_mpWfrG88A,AizaSyDFobzyAt7ljL2VwLZpSdaX4aBTUaqxNIA,AizaSyC7qG4Bpa9y-qsLZdgIsi37DRMITeFE1PY,AizaSyCJ0fIhZ6Xit6-QvmGRcyfxSgr1TaoyS2g,AizaSyBWuPK6dE8Abui9oVMtywVsPUor5JT-3fE,AizaSyCbN-wjX7NkHIDGlpzvA5X1uLtiUtUTCsQ,AizaSyAneP4TEZdcZQAFjnJpMihDz9V7eDMUigY,AizaSyBbhvZKfr122RsbmVQ8K5Rm2_mxq-7JCQE,AizaSyC9EKi2Q5PpGqV4RALDfvTG62ESwGkRsnI,AizaSyAuqbQm8ddQiMzYJhvk1raleIXpgKWuMhE,AizaSyALrYyeSgEwAkwLUvgg1ter2v7aAl3xgmI,AizaSyB_O5Gt39_k7H9boiH_uKck5KleNYJKEco,AizaSyAu5596B5EEeoXj5qLqScSqFRzrZrHkK94,AizaSyBWkOZviEEV_lQY01CvctpA1jGcDgIwVag,AizaSyBc-RMlfS9rfvtXaX6Vji4-z8MwvspGzm0,AizaSyA882OAvZSjcBeN4R01i8q4PWQKWij5mNI,AizaSyAFcue5WHv0TN0l4yyMUWKQkjijUKYXDlQ,AizaSyD0sbm4FSXJrIhw6zH9G2Zx-du_9m91LUQ,AizaSyD3QKc6LOf2wfNMMSwMmltfmFnwcmAXmPY,AizaSyBx2KzV-0IOjkbkswgze8W-D13EEubaMIY,AizaSyDRzHoACtkYImBiQb0InO_646ZpVhp1Z_0,AizaSyDshVNHeOwFqTSda2ChJ2ZEemm2yRqinT8,AizaSyAPomZYm1NBBlsM7DZT1LbJzdPYMKX91DU,AizaSyCGfJFdr1Y1t3oeNUtutjXDqywLqOcN12I,AizaSyDUe9CAZpuGtkpLuFiHaAsgUDK8Jvl23Ik,AizaSyAbXQ4jZQBLen9rkN5xFAj9H_5rbSUjQxQ,AizaSyDT_C2ptqKc4VmJtrnz4rm3WgHXAVv0wYw,AizaSyBV7Jgaeu1DX-DbzDRdRP6jMg-H8TkzyOU,AizaSyAWnXg19Y_KG2wOQ1gogYvw6OwXaOlK7jM,AizaSyArbGqK2kyC9jSPLYUODJMbinkhFswJGjg,AizaSyAiHAqVP30gMWM-Uwc2yEinGr5UjesQM9E,AizaSyCrRzIvlgjaJrRlWp3pczOWg77IiFxuRFg,AizaSyC7qBGgQubghPsciNnJLzZz4jz-ba-za64,AizaSyBigrTWtcL4lWLMwaCbTH58yUuFNajgS7U,AizaSyBj_sC9JHvtOwh7jjPFxULpI_etC6jy8Ss,AizaSyDgPKundrOnN644ro1XCsaPYop1b6-CP80,AizaSyAfR-brrpAs_E0AwHuNha3YYKDrbQGJaEY,AizaSyDc-7Vi0Wa0Daz6K8FJiXVTE8eFHLBMfIw,AizaSyB2u8YeqReMK92DXzRVsBkflan1zYAaK3E,AizaSyAwIhvN86XWlK4uSFOH4E675DpmyBlFCjA,AizaSyC-b388B-e7dJwklP3PpCti9FziyHnxaIk,AizaSyAi6xXjMImZrU0VjnwniiYeAKp7Mh5p18o,AizaSyD_WWu_pqqMsSoNzb-xGRFgJ1KQKDmqqAw,AizaSyALYkVfmlnu2jyasL70FtI1hh49RiIU2sI,AizaSyAlZzecrpLZ67f8S1GeiCZTUrA7R8Sx87U,AizaSyBdstg0Db1yLsi9F0trtCtptTmtfLsyQiA,AizaSyA5EJ2zbfvxeVgtXzx4rHyT522Qu8OlWNg,AizaSyCPt_DJVmg8ewjZFKp1Mx04Q7kJ005-0Qc,AizaSyDYUhbVuWVww6O5_DnyQuFKSRXGJB9iYTU,AizaSyAtKEaPCaH0JPkU8QCsib_tGngIYZHZReg,AizaSyD11jwFbcIYc-qagLZV5VIhGB9sz10ZO7k,AizaSyAj1RvG18FTtt9_mUA2izWOaQxXLjY4tBY,AizaSyD7eF-qZg0VH4CJzusR_fziDpNEiAxVNpk,AizaSyBPy03isP166YJT5mVkGCOjpFCeqxWNA0I,AizaSyD8VTvMvWnRCv17UDZlXEwctIKejTl9BWA";
    
    // Parse environmental keys
    const envKeysList = combinedKeys 
      ? combinedKeys.split(/[,;\s\n]+/).map((k: string) => k.replace(/['"]/g, '').trim()).filter(Boolean)
      : [];

    if (envKeysList.length > 0) {
      // The user has uploaded new API keys. To ensure old, exhausted, or disabled fallback keys
      // are completely bypassed, we use ONLY the user-provided keys from the environment.
      this.keys = Array.from(new Set(envKeysList));
      console.log(`GeminiManager: Successfully loaded ${this.keys.length} user-provided API keys. Fallback keys bypassed.`);
      
      // Also clear any legacy exhausted key state since we have fresh keys
      this.exhaustedKeys.clear();
      this.lastQuotaReset = Date.now();
    } else {
      // Fallback to hardcoded keys only if no environment keys are present
      const hardcodedKeysList = hardcodedKeys
        .split(/[,;\s\n]+/)
        .map((k: string) => k.trim())
        .filter(Boolean);
      this.keys = Array.from(new Set(hardcodedKeysList));
      console.log(`GeminiManager: No environment keys found. Using ${this.keys.length} fallback keys.`);
    }
    
    // Recovery: If it's been more than 1 hour, clear exhausted keys (optimistic reset)
    if (Date.now() - this.lastQuotaReset > 3600000) {
        this.exhaustedKeys.clear();
        this.lastQuotaReset = Date.now();
    }
  }

  private updateRotationIndex(newIndex: number) {
    this.currentIndex = newIndex;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(this.STORAGE_KEY, newIndex.toString());
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  getKeyId(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'key_' + Math.abs(hash).toString(36);
  }

  async logUsage(key: string, type: string) {
    try {
      const keyId = this.getKeyId(key);
      const masked = this.getMaskedKey(key);
      const currentUser = auth.currentUser;
      const email = currentUser?.email || 'anonymous';
      const userId = currentUser?.uid || 'anonymous';
      const timestamp = new Date().toISOString();
      
      await addDoc(collection(db, 'api_key_logs'), {
        keyHash: keyId,
        maskedKey: masked,
        email: email,
        userId: userId,
        type: type,
        timestamp: timestamp
      });
      
      // Update lastUsed in api_key_status to easily fetch during initialization
      await setDoc(doc(db, 'api_key_status', keyId), {
        keyHash: keyId,
        lastUsed: timestamp
      }, { merge: true });
      
      // Update in-memory lastUsed map immediately
      this.keyLastUsed.set(keyId, new Date(timestamp).getTime());
    } catch (e) {
      console.warn("Failed to log API key usage to Firestore:", e);
      handleFirestoreError(e, OperationType.CREATE, 'api_key_logs');
    }
  }

  async fetchStatuses() {
    try {
      const snap = await getDocs(collection(db, 'api_key_status'));
      const inactive = new Set<string>();
      const lastUsedMap = new Map<string, number>();
      
      snap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'inactive') {
          inactive.add(data.keyHash);
        }
        if (data.lastUsed) {
          lastUsedMap.set(data.keyHash, new Date(data.lastUsed).getTime());
        }
      });
      this.inactiveKeys = inactive;
      this.keyLastUsed = lastUsedMap;
      console.log(`GeminiManager: Loaded API key statuses. Inactive count: ${this.inactiveKeys.size}`);
    } catch (e) {
      console.warn("Failed to fetch API key statuses:", e);
      handleFirestoreError(e, OperationType.LIST, 'api_key_status');
    }
  }

  getApiKey(type?: string): string | null {
    // Re-check keys in case env changed without restart (unlikely but safe)
    if (this.keys.length === 0) {
        this.keyInit();
    }
    
    if (this.keys.length === 0) return null;
    
    let selectedKey = null;
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    // Filter available keys
    const availableKeys = this.keys.filter(k => !this.exhaustedKeys.has(k) && !this.inactiveKeys.has(this.getKeyId(k)));

    if (availableKeys.length > 0) {
      // Find keys unused for > 3 months (or never used)
      const unusedKeys = availableKeys.filter(k => {
        const lastUsed = this.keyLastUsed.get(this.getKeyId(k));
        return !lastUsed || (now - lastUsed > ninetyDaysMs);
      });

      if (unusedKeys.length > 0) {
        // Round-robin through unused keys to distribute traffic across the cluster
        const nextUnused = unusedKeys.find(k => this.keys.indexOf(k) >= this.currentIndex) || unusedKeys[0];
        selectedKey = nextUnused;
        const index = this.keys.indexOf(selectedKey);
        this.updateRotationIndex((index + 1) % this.keys.length);
      } else {
        // Standard rotation
        for (let i = 0; i < this.keys.length; i++) {
            const index = (this.currentIndex + i) % this.keys.length;
            const key = this.keys[index];
            
            if (!this.exhaustedKeys.has(key) && !this.inactiveKeys.has(this.getKeyId(key))) {
                selectedKey = key;
                this.updateRotationIndex((index + 1) % this.keys.length);
                break;
            }
        }
      }
    }
    
    // Safety: If ALL active keys are exhausted, clear the active key pool and retry
    if (!selectedKey) {
        // Let's filter out completely inactive keys and try to find an active one
        const activeKeys = this.keys.filter(k => !this.inactiveKeys.has(this.getKeyId(k)));
        if (activeKeys.length > 0) {
            console.log("GeminiManager: All active keys exhausted. Resetting exhausted states.");
            for (const k of activeKeys) {
                this.exhaustedKeys.delete(k);
            }
            selectedKey = activeKeys[0];
            const index = this.keys.indexOf(selectedKey);
            this.updateRotationIndex((index + 1) % this.keys.length);
        } else {
            console.warn("GeminiManager: All keys are marked inactive!");
            return null;
        }
    }

    // Immediately record usage timestamp in memory to prevent rapid key reuse
    if (selectedKey) {
      this.keyLastUsed.set(this.getKeyId(selectedKey), now);
    }
    
    // Log usage if type is provided
    if (selectedKey && type) {
      this.logUsage(selectedKey, type);
    }
    
    return selectedKey;
  }

  getAllKeysDetails() {
    return this.keys.map((key, index) => {
      const keyId = this.getKeyId(key);
      return {
        index,
        keyId,
        masked: this.getMaskedKey(key),
        status: this.inactiveKeys.has(keyId) ? 'inactive' as const : 'active' as const,
        isExhausted: this.exhaustedKeys.has(key)
      };
    });
  }

  async setKeyStatus(keyId: string, status: 'active' | 'inactive') {
    try {
      if (status === 'inactive') {
        this.inactiveKeys.add(keyId);
      } else {
        this.inactiveKeys.delete(keyId);
      }
      
      await setDoc(doc(db, 'api_key_status', keyId), {
        keyHash: keyId,
        status: status,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || 'admin'
      });
    } catch (e) {
      console.error(`Failed to update key status for ${keyId}:`, e);
      handleFirestoreError(e, OperationType.WRITE, `api_key_status/${keyId}`);
      throw e;
    }
  }

  async setAllKeysStatus(status: 'active' | 'inactive') {
    try {
      const batch = writeBatch(db);
      
      this.keys.forEach((key) => {
        const keyId = this.getKeyId(key);
        if (status === 'inactive') {
          this.inactiveKeys.add(keyId);
        } else {
          this.inactiveKeys.delete(keyId);
        }
        
        batch.set(doc(db, 'api_key_status', keyId), {
          keyHash: keyId,
          status: status,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.email || 'admin'
        });
      });
      
      await batch.commit();
    } catch (e) {
      console.error("Failed to update all keys status:", e);
      handleFirestoreError(e, OperationType.WRITE, 'api_key_status');
      throw e;
    }
  }

  markExhausted(key: string, isPermanent: boolean = true) {
    if (!key) return;
    
    if (isPermanent) {
      this.exhaustedKeys.add(key);
      console.warn(`Gemini API Key exhausted (Permanent): ${this.getMaskedKey(key)}. Switching to next.`);
    } else {
      // For transient errors, we rotate but don't add to exhaustedKeys immediately
      console.warn(`Gemini API Key glitch (Transient): ${this.getMaskedKey(key)}. Rotating cluster...`);
    }

    // Rotate index to next key
    const index = this.keys.indexOf(key);
    if (index !== -1) {
        this.updateRotationIndex((index + 1) % this.keys.length);
    }
  }

  hasMultipleKeys(): boolean {
    return this.keys.length > 1;
  }

  getAvailableKeysCount(): number {
    return this.keys.filter(k => !this.exhaustedKeys.has(k)).length;
  }

  getTotalKeysCount(): number {
    return this.keys.length;
  }

  private getMaskedKey(key: string): string {
    if (key.length <= 8) return "****";
    return key.substring(0, 4) + "****" + key.substring(key.length - 4);
  }

  isQuotaError(error: any): boolean {
    if (!error) return false;
    
    // Extract error text from various possible formats
    const msg = (error?.message || error?.toString() || String(error)).toLowerCase();
    let fullErrorStr = '';
    try {
      if (typeof error === 'object') {
        fullErrorStr = JSON.stringify(error).toLowerCase();
      }
    } catch (_) {}
    
    const isMatched = (str: string) => msg.includes(str) || fullErrorStr.includes(str);
    
    // Check for Quota/Rate Limit (429) or Resource Exhaustion
    if (isMatched('quota') || isMatched('rate limit') || isMatched('429') || isMatched('resource_exhausted')) {
        return true;
    }
    
    // Check for Internal/Network/Transient/High-demand issues (500, 503, etc)
    if (isMatched('internal error') || 
        isMatched('500') || 
        isMatched('503') || 
        isMatched('unavailable') ||
        isMatched('high demand') ||
        isMatched('network error') || 
        isMatched('failed to fetch') ||
        isMatched('aborted') ||
        isMatched('service unavailable') ||
        isMatched('deadline exceeded')) {
        return true;
    }
    
    return false;
  }

  // Helper to check if an error is specifically a Quota issue vs a transient one
  isSpecificallyQuota(error: any): boolean {
    const msg = (error?.message || error?.toString() || String(error)).toLowerCase();
    let fullErrorStr = '';
    try {
      if (typeof error === 'object') {
        fullErrorStr = JSON.stringify(error).toLowerCase();
      }
    } catch (_) {}
    return msg.includes('quota') || msg.includes('rate limit') || msg.includes('429') || msg.includes('resource_exhausted') || fullErrorStr.includes('resource_exhausted') || fullErrorStr.includes('quota');
  }

  getKeyByIndex(index: number): string | null {
    if (index >= 0 && index < this.keys.length) {
      return this.keys[index];
    }
    return null;
  }

  async pingKeyByIndex(index: number, prompt: string = 'ping'): Promise<KeyPingResult> {
    if (index < 0 || index >= this.keys.length) {
      throw new Error(`Invalid key index: ${index}`);
    }
    const key = this.keys[index];
    const keyId = this.getKeyId(key);
    const masked = this.getMaskedKey(key);
    const startTime = Date.now();

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            maxOutputTokens: 5,
            temperature: 0.1,
          }
        });
      } catch (flashErr) {
        // Fallback to gemini-3.8-flash if 2.5-flash is temporarily busy
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            maxOutputTokens: 5,
            temperature: 0.1,
          }
        });
      }

      const latencyMs = Date.now() - startTime;
      const text = response.text ? response.text.trim() : 'OK';

      // Update in-memory state
      this.keyLastUsed.set(keyId, Date.now());
      this.exhaustedKeys.delete(key);

      // Log usage to Firestore
      await this.logUsage(key, 'keep_alive_ping');

      return {
        index,
        keyId,
        masked,
        status: 'success',
        message: text.length > 40 ? text.substring(0, 40) + '...' : text,
        latencyMs,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errMsg = err?.message || err?.toString() || 'Unknown error';
      const isQuota = this.isSpecificallyQuota(err);
      
      if (isQuota) {
        this.markExhausted(key, false);
      }

      // Even on quota error, Google Cloud registered the API call and reset the 6-month timer!
      if (isQuota) {
        this.keyLastUsed.set(keyId, Date.now());
        await this.logUsage(key, 'keep_alive_quota_hit').catch(() => {});
      }

      // Clean up error message for display
      let cleanMsg = errMsg;
      try {
        if (errMsg.includes('{')) {
          const parsed = JSON.parse(errMsg);
          if (parsed.error?.message) {
            cleanMsg = parsed.error.message;
          }
        }
      } catch (_) {}

      return {
        index,
        keyId,
        masked,
        status: isQuota ? 'quota_exhausted' : 'error',
        message: cleanMsg.length > 80 ? cleanMsg.substring(0, 80) + '...' : cleanMsg,
        latencyMs,
        timestamp: new Date().toISOString()
      };
    }
  }

  async runKeepAliveRoutine(options?: {
    prompt?: string;
    concurrency?: number;
    delayMs?: number;
    onlyStaleKeys?: boolean;
    staleThresholdMs?: number;
    signal?: AbortSignal;
    onProgress?: (progress: KeepAliveProgress) => void;
  }): Promise<KeepAliveProgress> {
    const prompt = options?.prompt || 'ping';
    const concurrency = Math.max(1, Math.min(options?.concurrency || 3, 5));
    const delayMs = options?.delayMs !== undefined ? options.delayMs : 120;
    const signal = options?.signal;
    const onProgress = options?.onProgress;
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const thresholdMs = options?.staleThresholdMs || ninetyDaysMs;
    const now = Date.now();

    // Determine target indices
    let targetIndices: number[] = [];
    for (let i = 0; i < this.keys.length; i++) {
      const keyId = this.getKeyId(this.keys[i]);
      if (options?.onlyStaleKeys) {
        const lastUsed = this.keyLastUsed.get(keyId);
        if (!lastUsed || (now - lastUsed > thresholdMs)) {
          targetIndices.push(i);
        }
      } else {
        targetIndices.push(i);
      }
    }

    const total = targetIndices.length;
    const results: KeyPingResult[] = [];
    let successCount = 0;
    let failCount = 0;
    let isCancelled = false;
    const startTime = Date.now();

    const report = (current: number, currentKeyMasked: string, currentKeyIndex: number, isFinished = false, statusMsg: string = '') => {
      if (onProgress) {
        onProgress({
          total,
          current,
          successCount,
          failCount,
          currentKeyMasked,
          currentKeyIndex,
          results: [...results],
          isFinished,
          isCancelled,
          statusMessage: statusMsg
        });
      }
    };

    let nextQueueIndex = 0;

    const worker = async () => {
      while (nextQueueIndex < targetIndices.length) {
        if (signal?.aborted) {
          isCancelled = true;
          break;
        }

        const taskIndex = nextQueueIndex++;
        const keyIndex = targetIndices[taskIndex];
        const keyMasked = this.getMaskedKey(this.keys[keyIndex]);

        report(results.length, keyMasked, keyIndex, false, `Querying key #${keyIndex + 1} (${keyMasked})...`);

        const res = await this.pingKeyByIndex(keyIndex, prompt);
        results.push(res);

        if (res.status === 'success') {
          successCount++;
        } else {
          failCount++;
        }

        report(results.length, keyMasked, keyIndex, false, `Key #${keyIndex + 1} responded (${res.status})`);

        if (delayMs > 0 && nextQueueIndex < targetIndices.length && !signal?.aborted) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    };

    if (total > 0) {
      const activeWorkerCount = Math.min(concurrency, total);
      const workers = Array.from({ length: activeWorkerCount }, () => worker());
      await Promise.all(workers);
    }

    const durationMs = Date.now() - startTime;
    const currentUser = auth.currentUser;
    const runBy = currentUser?.email || 'admin';

    const summary: KeepAliveSummary = {
      lastRunAt: new Date().toISOString(),
      totalKeys: total,
      successCount,
      failCount,
      durationMs,
      runBy,
      isCancelled
    };

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gemini_last_keep_alive_run', JSON.stringify(summary));
      }
    } catch (e) {
      console.warn("Could not save keep-alive run summary:", e);
    }

    // Also persist to Firestore
    await this.saveKeepAliveSummary(summary);

    report(results.length, '', -1, true, isCancelled ? 'Routine cancelled by user' : 'Routine successfully completed');

    return {
      total,
      current: results.length,
      successCount,
      failCount,
      currentKeyMasked: '',
      currentKeyIndex: -1,
      results,
      isFinished: true,
      isCancelled,
      statusMessage: isCancelled ? 'Cancelled' : 'Completed'
    };
  }

  async saveKeepAliveSummary(summary: KeepAliveSummary) {
    try {
      await setDoc(doc(db, 'app_settings', 'api_keep_alive'), {
        ...summary,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not save keep-alive record to Firestore:", e);
    }
  }

  async getKeepAliveSummaryFromFirestore(): Promise<KeepAliveSummary | null> {
    try {
      const snap = await getDoc(doc(db, 'app_settings', 'api_keep_alive'));
      if (snap.exists()) {
        return snap.data() as KeepAliveSummary;
      }
    } catch (e) {
      console.warn("Could not fetch keep-alive summary:", e);
    }
    return null;
  }

  getLastKeepAliveInfo(): KeepAliveSummary | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('gemini_last_keep_alive_run');
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  getInactivitySummary() {
    const total = this.keys.length;
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const fiveMonthsMs = 150 * 24 * 60 * 60 * 1000;

    let staleCount = 0;
    let criticalCount = 0;
    let neverUsedCount = 0;
    let freshCount = 0;

    for (const key of this.keys) {
      const keyId = this.getKeyId(key);
      const lastUsed = this.keyLastUsed.get(keyId);
      if (!lastUsed) {
        neverUsedCount++;
        staleCount++;
      } else {
        const age = now - lastUsed;
        if (age > fiveMonthsMs) {
          criticalCount++;
          staleCount++;
        } else if (age > ninetyDaysMs) {
          staleCount++;
        } else {
          freshCount++;
        }
      }
    }

    return {
      total,
      staleCount,
      criticalCount,
      neverUsedCount,
      freshCount,
    };
  }
}

export const geminiManager = new GeminiManager();
