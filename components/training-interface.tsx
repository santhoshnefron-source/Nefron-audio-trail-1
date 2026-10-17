'use client';

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { geminiManager } from '../lib/gemini-manager';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { 
  Send, 
  Loader2, 
  Database, 
  Trash2, 
  Edit3, 
  Plus, 
  RefreshCw, 
  X, 
  Check, 
  Brain, 
  Search, 
  Sparkles, 
  Sliders,
  Cpu,
  Monitor,
  Workflow
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Skeleton } from './ui/skeleton';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { requireHardwareBiometricAssertion, secureEncryptPayload, secureDecryptPayload } from '../lib/security';

interface KnowledgeFact {
  id: string;
  category: string;
  content: string;
  updatedAt?: any;
  updatedBy?: string;
}

interface Message {
  id: string;
  role: 'user' | 'bot' | 'model' | 'function';
  content: string;
  createdAt?: Date;
  isSystemEvent?: boolean;
}

export function TrainingInterface({ userId }: { userId: string }) {
  // Facts state
  const [facts, setFacts] = useState<KnowledgeFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Custom fact entry form
  const [isAddingFact, setIsAddingFact] = useState(false);
  const [newFactCategory, setNewFactCategory] = useState('General');
  const [newFactContent, setNewFactContent] = useState('');
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingCategory, setEditingCategory] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [aiThinkingSteps, setAiThinkingSteps] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const categories = [
    'All',
    'Core Specs',
    'Acoustic Physics',
    'Brain Infrastructure',
    'AI Capabilities',
    'Financial Blueprint',
    'General'
  ];

  // 1. Fetch Facts
  const loadFacts = async () => {
    setFactsLoading(true);
    try {
      const collectionRef = collection(db, 'ai_data_core');
      const q = query(collectionRef, orderBy('category', 'asc'));
      const snapshot = await getDocs(q);
      const factsList: KnowledgeFact[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let decryptedContent = data.content || '';
        
        // Transparently detect and decrypt AES-GCM payloads
        if (decryptedContent.includes(':') && data.content.length > 50) {
           decryptedContent = await secureDecryptPayload(decryptedContent);
        }

        factsList.push({
          id: docSnap.id,
          category: data.category || 'General',
          content: decryptedContent,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy || 'Unknown'
        });
      }
      
      setFacts(factsList);

      // If facts list is completely empty, trigger seeding
      if (factsList.length === 0) {
        await preseedDatabase();
      }
    } catch (err) {
      console.error("Error loading facts from firestore:", err);
      handleFirestoreError(err, OperationType.LIST, 'ai_data_core');
    } finally {
      setFactsLoading(false);
    }
  };

  // 2. Preseed Database
  const preseedDatabase = async () => {
    setIsSeeding(true);
    try {
      const defaultFacts = [
        {
          category: 'Core Specs',
          content: 'Core Innovation: Electro-mechanical steering (replacing amplitude panning) to eliminate the "sweet spot" and provide physically accurate immersion.'
        },
        {
          category: 'Core Specs',
          content: 'Mechanical Specs: Dual-axis NEMA 17 stepper motors (0-180°), modular 3.5ft x 3.5ft units.'
        },
        {
          category: 'Acoustic Physics',
          content: 'Acoustic Array Layout: Staggered Diamond Pattern array with 9 high-SPL drivers per modular unit.'
        },
        {
          category: 'Acoustic Physics',
          content: 'Acoustics setup utilizes a 45° Inward Angling placement to minimize harmful first side reflections and floor-coupled transducers for Tactile Low Bass.'
        },
        {
          category: 'Acoustic Physics',
          content: 'Psychoacoustic Moat: Employs target infrasound waves at 17-19 Hz to trigger psychological tension and physical impact in movie theaters.'
        },
        {
          category: 'Brain Infrastructure',
          content: 'Server Setup Standard: Tier 3 PLF / IMAX theater installation powered by 2x AMD EPYC 9004, 2x Nvidia RTX 6000 Ada, 256GB ECC DDR5, and 10Gbps Fiber uplink.'
        },
        {
          category: 'Brain Infrastructure',
          content: 'Enterprise Big Scale Setup: 4x AMD EPYC 9754 node servers, 4x Nvidia H100 GPU clusters, 2TB high bandwidth HBM memory, and 100Gbps InfiniBand interconnects.'
        },
        {
          category: 'AI Capabilities',
          content: 'Tracking Engines: Real-time Audio Follows Video (AFV) active listener spatial tracking, automatic Self-Healing room calibration, and 4D acoustic depth reconstruction.'
        },
        {
          category: 'Financial Blueprint',
          content: 'Unit Hardware Unit Cost: ₹3,50,000 (INR 3.5 Lakhs) for a single industrial-grade modular active assembly.'
        },
        {
          category: 'Financial Blueprint',
          content: 'Standard Premium Large Format (PLF) Complete Project Cost: ₹4,25,00,000 (INR 4.25 Crore) supporting 113 networked modules and standard Core Brain control server.'
        },
        {
          category: 'Financial Blueprint',
          content: 'Operational Expenditure (OpEx): Standard ₹15,000 cost per show session run based on Scenario B industrial electricity loads.'
        }
      ];

      const collectionRef = collection(db, 'ai_data_core');
      for (const fact of defaultFacts) {
        await addDoc(collectionRef, {
          category: fact.category,
          content: fact.content,
          updatedAt: serverTimestamp(),
          updatedBy: 'System Preseed'
        });
      }
      
      // Reload updated facts list
      const snapshot = await getDocs(query(collectionRef, orderBy('category', 'asc')));
      const factsList: KnowledgeFact[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        factsList.push({
          id: docSnap.id,
          category: data.category || 'General',
          content: data.content || '',
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy || 'Unknown'
        });
      });
      setFacts(factsList);
    } catch (err) {
      console.error("Seeding database failed:", err);
      handleFirestoreError(err, OperationType.CREATE, 'ai_data_core');
    } finally {
      setIsSeeding(false);
    }
  };

  // 3. Load Chat History
  const loadChatHistory = async () => {
    setChatLoading(true);
    try {
      const collectionRef = collection(db, 'training_chats');
      const q = query(collectionRef, orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      const msgsList: Message[] = [];
      
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        msgsList.push({
          id: docSnap.id,
          role: data.role,
          content: data.content,
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date()
        });
      });

      if (msgsList.length === 0) {
        const welcomeText = `Greetings, Administrator. I am your specialized Knowledge Representative & Database Core Manager.

I have direct root privileges to modify our AI's Core Intelligence Data Core in Firestore. Any additions or updates we make here will dynamically calibrate and retrain the systems instructions of all user-facing AI models instantly.

You can direct me to:
- **Add new specs**: "Add a fact about our new $50B scale projection to Core Specs"
- **Update existing metrics**: "Update our standard Project Cost to ₹5 Crore"
- **Review facts**: "Find what is currently configured in acoustic physics"
- **Delete outdated rows**: "Remove the spec about the 2x AMD EPYC server"

All training conversations in this zone are restricted to your email and saved forever in Firestore. How shall we calibrate the AI core today?`;
        
        // Initial setup
        const welcomeMsg: Message = {
          id: 'welcome',
          role: 'bot',
          content: welcomeText,
          createdAt: new Date()
        };
        setChatMessages([welcomeMsg]);
      } else {
        setChatMessages(msgsList);
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
      handleFirestoreError(err, OperationType.LIST, 'training_chats');
    } finally {
      setChatLoading(false);
    }
  };

  // Trigger loads on Mount
  useEffect(() => {
    loadFacts();
    loadChatHistory();
  }, [userId]);

  // Scroll chats to bottom completely even after large content paint
  useEffect(() => {
    const scrollToBottom = () => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };
    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timeoutId);
  }, [chatMessages, aiThinkingSteps]);

  // 4. Manual Operations (Left Side Actions)
  const handleAddNewFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactContent.trim()) return;

    // Zero Trust: Enforce hardware biometric assertion before critical backend mutation
    const hasClearance = await requireHardwareBiometricAssertion();
    if (!hasClearance) {
      alert("SECURITY VIOLATION: Hardware biometric clearance failed. Access denied to AI Data Core.");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const rawContent = newFactContent.trim();
    const optimisticCategory = newFactCategory;
    
    // 1. OPTIMISTIC UPDATE
    setFacts(prev => [...prev, {
      id: tempId,
      category: optimisticCategory,
      content: rawContent,
      updatedBy: auth.currentUser?.email || 'p26893150@gmail.com',
      updatedAt: { toDate: () => new Date() }
    }]);

    setNewFactContent('');
    setIsAddingFact(false);

    try {
      // Encrypt the sensitive payload before it enters transit
      const encryptedContent = await secureEncryptPayload(rawContent);
      
      const factData = {
        category: optimisticCategory,
        content: encryptedContent,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'p26893150@gmail.com'
      };
      
      const docRef = await addDoc(collection(db, 'ai_data_core'), factData);
      
      // 2. RECONCILE
      setFacts(prev => prev.map(f => f.id === tempId ? { ...f, id: docRef.id } : f));
    } catch (err) {
      console.error("Error manually adding fact:", err);
      // 3. ROLLBACK
      setFacts(prev => prev.filter(f => f.id !== tempId));
      handleFirestoreError(err, OperationType.CREATE, 'ai_data_core');
    }
  };

  const handleUpdateFact = async (id: string) => {
    if (!editingContent.trim()) return;

    const originalFact = facts.find(f => f.id === id);
    if (!originalFact) return;

    const updatedCategory = editingCategory;
    const updatedContent = editingContent.trim();
    
    // 1. OPTIMISTIC UPDATE
    setFacts(prev => prev.map(fact => 
      fact.id === id 
        ? { ...fact, category: updatedCategory, content: updatedContent, updatedBy: auth.currentUser?.email || 'p26893150@gmail.com', updatedAt: { toDate: () => new Date() } }
        : fact
    ));
    setEditingFactId(null);

    try {
      const docRef = doc(db, 'ai_data_core', id);
      const updateData = {
        category: updatedCategory,
        content: updatedContent,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'p26893150@gmail.com'
      };

      await setDoc(docRef, updateData);
    } catch (err) {
      console.error("Error manually updating fact:", err);
      // 3. ROLLBACK
      setFacts(prev => prev.map(f => f.id === id ? originalFact : f));
      handleFirestoreError(err, OperationType.UPDATE, `ai_data_core/${id}`);
    }
  };

  const handleDeleteFact = async (id: string) => {
    const originalFact = facts.find(f => f.id === id);
    if (!originalFact) return;
    
    // 1. OPTIMISTIC UPDATE (instant UI update)
    setFacts(prev => prev.filter(fact => fact.id !== id));

    try {
      await deleteDoc(doc(db, 'ai_data_core', id));
    } catch (err) {
      console.error("Error manually deleting fact:", err);
      // 3. ROLLBACK
      setFacts(prev => {
        const newFacts = [...prev, originalFact];
        return newFacts.sort((a, b) => a.category.localeCompare(b.category));
      });
      handleFirestoreError(err, OperationType.DELETE, `ai_data_core/${id}`);
    }
  };

  // 5. Intelligent Gemini Operations & Recursive Tools Resolver (Right Side Conversations)
  const addFactDirectly = async (category: string, content: string) => {
    const docRef = await addDoc(collection(db, 'ai_data_core'), {
      category: category || 'General',
      content: content,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.email || 'p26893150@gmail.com'
    });
    setFacts(prev => [...prev, {
      id: docRef.id,
      category: category || 'General',
      content: content,
      updatedBy: auth.currentUser?.email || 'p26893150@gmail.com',
      updatedAt: { toDate: () => new Date() }
    }]);
    return { status: 'success', id: docRef.id, category, content };
  };

  const updateFactDirectly = async (id: string, category: string, content: string) => {
    const docRef = doc(db, 'ai_data_core', id);
    await setDoc(docRef, {
      category: category || 'General',
      content: content,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.email || 'p26893150@gmail.com'
    });
    setFacts(prev => prev.map(fact => 
      fact.id === id 
        ? { ...fact, category: category || 'General', content: content, updatedBy: auth.currentUser?.email || 'p26893150@gmail.com', updatedAt: { toDate: () => new Date() } }
        : fact
    ));
    return { status: 'success', id, category, content };
  };

  const deleteFactDirectly = async (id: string) => {
    await deleteDoc(doc(db, 'ai_data_core', id));
    setFacts(prev => prev.filter(fact => fact.id !== id));
    return { status: 'success', id };
  };

  const executeChatAndTools = async (messagesForAI: any[], retryCount = 0): Promise<string> => {
    const apiKey = geminiManager.getApiKey();
    if (!apiKey) throw new Error("No Gemini API keys are configured currently.");

    const ai = new GoogleGenAI({ apiKey });
    
    // Tools Declarations matching Schema
    const tools: any[] = [{
      functionDeclarations: [
        {
          name: 'getKnowledgeFacts',
          description: 'Get all the knowledge facts currently configured in the AI Data Core database.',
          parameters: { type: 'OBJECT', properties: {} }
        },
        {
          name: 'addKnowledgeFact',
          description: 'Add a new specification list item or knowledge fact to our system AI database.',
          parameters: {
            type: 'OBJECT',
            properties: {
              category: { 
                type: 'STRING', 
                description: 'The category, must select one exactly from this list: "Core Specs", "Acoustic Physics", "Brain Infrastructure", "AI Capabilities", "Financial Blueprint", "General"' 
              },
              content: { 
                type: 'STRING', 
                description: 'The actual details of the fact or technical specification checklist' 
              }
            },
            required: ['category', 'content']
          }
        },
        {
          name: 'updateKnowledgeFact',
          description: 'Update the content and category specifications of an existing knowledge fact document in the database.',
          parameters: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING', description: 'The exact documents ID hash of the fact to modify.' },
              category: { 
                type: 'STRING', 
                description: 'The category, must select one exactly from this list: "Core Specs", "Acoustic Physics", "Brain Infrastructure", "AI Capabilities", "Financial Blueprint", "General"' 
              },
              content: { type: 'STRING', description: 'The newly refined text specifications to save.' }
            },
            required: ['id', 'category', 'content']
          }
        },
        {
          name: 'deleteKnowledgeFact',
          description: 'Completely delete an obsolete knowledge fact from the core AI database using its document ID.',
          parameters: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING', description: 'The exact ID of the document to be removed.' }
            },
            required: ['id']
          }
        }
      ]
    }];

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: messagesForAI,
        config: {
          systemInstruction: `You are the ultimate Nefron AI Training Representative and Knowledge Core Database Manager. You have comprehensive, up-to-date knowledge of global affairs, economics, tech, and marketing trends.

**ADVANCED CONTEXTUAL MATCHING**: 
Always evaluate if the user's message is a continuation of the immediate previous turn or a callback to an earlier topic in the chat history. If they abruptly switch topics to something discussed earlier, use the provided past conversation history to understand their context and respond seamlessly. ALWAYS formulate a complete, relevant text response. Do not output an empty response.

You have absolute root privilege to query, add, edit, or delete items inside the Firestore core database (our "AI Data Core") on behalf of the Certified Administrator Trainer.

When they want to change or query knowledge items, you MUST invoke the appropriate Tool Call functions!
Available tools: getKnowledgeFacts, addKnowledgeFact, updateKnowledgeFact, deleteKnowledgeFact.

Guidelines:
1. When asked to change some fact, e.g. "Update our Project Cost to ₹5Cr":
   - FIRST, call "getKnowledgeFacts" to lookup the database, find the document ID of the fact related to "Project Cost" or "Financial Blueprint".
   - SECOND, after receiving the list, execute the "updateKnowledgeFact" tool with the exact document ID, category, and the updated content!
   - This ensures ultra-accurate database alignment.
2. If adding a new specification, categorize it fittingly under one of: "Core Specs", "Acoustic Physics", "Brain Infrastructure", "AI Capabilities", "Financial Blueprint", or "General".
3. When you successfully perform a write operation (add, update, delete), clearly explain to the trainer that the AI Core has been updated in real-time, and that ALL other user assistants in the application will be dynamically guided by this new truth immediately!
4. Respond in an extremely professional, technical, yet helpful tone suitable for an elite administrator console. Highlight essential variables, keys or values using bold labels.
5. **APP UI & NAVIGATION AWARENESS (CRITICAL - YOU MUST KNOW THE APP STRUCTURE)**:
   You have full awareness of this application's features and must proactively suggest them to the user when relevant to enhance their experience.
   - **About Page**: Contains all visual architectures, diagrams, founder details (Santhosh), and technical specifications. (Access: Click "About" in the main left sidebar menu). Suggest when the user asks about diagrams, visual clarification, architecture blueprints, or deep technical reads (e.g., "For visual clarification, please see the images in the About page under the sidebar").
   - **Interactive Chat (Nefron AI)**: The live text chat interface. (Access: Click "Nefron AI" in the main left sidebar menu).
   - **Voice Chat Experience**: A hands-free, real-time voice conversation mode. (Access: Tap the microphone icon at the bottom of the Nefron AI chat interface). Suggest for a more immersive or conversational experience (e.g., "For a better interactive live experience, use our voice chat! Just tap the microphone icon at the bottom of the chat interface").
   - **Knowledge Core (Training Interface)**: You are currently operating inside this interface. Acknowledge this is a private admin-only tool for the founder (Santhosh). Do not tell users to navigate here since they are already here.
   - **Dashboard & Analytics**: Shows live stats, caching metrics, and optimistic rendering demos. (Access: Click "Dashboard" in the main left sidebar).
   - **Holographic Experience**: (Access: Click "Holographic" in the main left sidebar menu).
   - **Themes & Personalization**: The app supports Dark/Light modes and Color Themes (Purple, Electric, Golden). (Access: Use the bottom section of the left sidebar).`,
          tools: tools,
        }
      });

      const candidate = response.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      // If the model called a tool
      if (part && 'functionCall' in part && part.functionCall) {
        const call = part.functionCall;
        const { name, args } = call as any;
        
        // Log step in UI
        setAiThinkingSteps(prev => [
          ...prev, 
          `[CMD] Invoking Database Protocol: "${name}" with args: ${JSON.stringify(args)}`
        ]);

        let actionResult: any;
        try {
          if (name === 'getKnowledgeFacts') {
            const collectionRef = collection(db, 'ai_data_core');
            const snapshot = await getDocs(query(collectionRef, orderBy('category', 'asc')));
            const rawList: any[] = [];
            snapshot.forEach(dSnap => rawList.push({ id: dSnap.id, ...dSnap.data() }));
            actionResult = rawList;
          } else if (name === 'addKnowledgeFact') {
            actionResult = await addFactDirectly(args.category, args.content);
          } else if (name === 'updateKnowledgeFact') {
            actionResult = await updateFactDirectly(args.id, args.category, args.content);
          } else if (name === 'deleteKnowledgeFact') {
            actionResult = await deleteFactDirectly(args.id);
          } else {
            actionResult = { error: `Command ${name} is unregistered.` };
          }
        } catch (err: any) {
          actionResult = { error: err.message || "Failed execution" };
        }

        setAiThinkingSteps(prev => [
          ...prev,
          `[SYS] Database answered successfully with ${JSON.stringify(actionResult).substring(0, 80)}...`
        ]);

        // Construct turns for next loop iteration
        const updatedMessages = [
          ...messagesForAI,
          {
            role: 'model',
            parts: [part]
          },
          {
            role: 'function',
            parts: [{
              functionResponse: {
                name,
                response: { result: actionResult }
              }
            }]
          }
        ];

        // Recurse to let the AI finish their explanation
        return executeChatAndTools(updatedMessages, retryCount);
      } else {
        // Return natural language response
        return response.text || "Database operation handled.";
      }

    } catch (error: any) {
      console.error("Recursive chat failure:", error);
      if (geminiManager.isQuotaError(error)) {
        const isPermanent = geminiManager.isSpecificallyQuota(error);
        geminiManager.markExhausted(apiKey, isPermanent);
        if (retryCount < geminiManager.getTotalKeysCount()) {
          setAiThinkingSteps(prev => [...prev, `[ERR] Key rotated. Moving to next core unit...`]);
          return executeChatAndTools(messagesForAI, retryCount + 1);
        }
      }
      throw error;
    }
  };

  const handleSendTrainingMessage = async (trainerPrompt: string) => {
    if (!trainerPrompt.trim() || isSending) return;

    setIsSending(true);
    setAiThinkingSteps([`Processing trainer query...`]);

    // Construct local user message Object
    const userMsg: Message = {
      id: 'train-' + Date.now(),
      role: 'user',
      content: trainerPrompt,
      createdAt: new Date()
    };

    // Save user query to UI immediately
    setChatMessages(prev => [...prev, userMsg]);

    try {
      // 1. Save user query to training chats Firestore collection so it stays forever!
      try {
        await addDoc(collection(db, 'training_chats'), {
          role: 'user',
          content: trainerPrompt,
          createdAt: serverTimestamp(),
          userId: auth.currentUser?.uid || 'rqs4ajG458NIs7zF1WusNe4UQd32'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'training_chats');
      }

      // 2. Format history for AI calling (limit history window for efficiency)
      // Retrieve last 15 messages for keeping active contextual memory
      try {
        const recentChatsSnap = await getDocs(query(collection(db, 'training_chats'), orderBy('createdAt', 'desc'), limit(15)));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'training_chats');
      }
      
      // Note: we can also just convert our current local chatMessages state which holds all chats!
      // To ensure absolute exact context mapping, we will convert the local chatMessages.
      const formattedHistory = chatMessages
        .filter(m => m.id !== 'welcome') // Skip client welcome template
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

      // Append active prompt
      formattedHistory.push({
        role: 'user',
        parts: [{ text: trainerPrompt }]
      });

      // 3. Resolve Tools Loop Recursively
      const finalReply = await executeChatAndTools(formattedHistory);

      // 4. Save AI final message dynamically to Firestore
      let aiDocRef;
      try {
        aiDocRef = await addDoc(collection(db, 'training_chats'), {
          role: 'bot',
          content: finalReply,
          createdAt: serverTimestamp(),
          userId: auth.currentUser?.uid || 'rqs4ajG458NIs7zF1WusNe4UQd32'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'training_chats');
      }

      // Show in UI
      if (aiDocRef) {
        setChatMessages(prev => [...prev, {
          id: aiDocRef.id,
          role: 'bot',
          content: finalReply,
          createdAt: new Date()
        }]);
      }

    } catch (err: any) {
      console.error("Failed to train core:", err);
      const isOwner = auth.currentUser?.email === 'p26893150@gmail.com';
      setChatMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'bot',
        content: isOwner ? `**Security Alert:** System failed to register database modifications.\nDetails: ${err.message || 'Network Timeout'}` : `The training module is experiencing delays, please try submitting again later.`
      }]);
    } finally {
      setIsSending(false);
      setAiThinkingSteps([]);
    }
  };

  // Filter and search facts
  const filteredFacts = facts.filter(fact => {
    const matchesSearch = 
      fact.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fact.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'All') return matchesSearch;
    return fact.category === selectedCategory && matchesSearch;
  });

  return (
    <TooltipProvider delayDuration={100}>
      <div className="absolute inset-0 p-3 md:p-4 pb-12 md:pb-4 overflow-y-auto custom-scrollbar bg-transparent flex flex-col lg:flex-row gap-6 scroll-smooth snap-y snap-mandatory lg:snap-none">
      {/* AI DATA CORE DATABASE VIEW */}
      <div className="h-[85vh] lg:h-full w-full lg:w-[40%] flex flex-col bg-gray-dark/95 backdrop-blur-md rounded-2xl border border-foreground/15 overflow-hidden shadow-2xl shrink-0 relative snap-center max-w-5xl mx-auto">
        {/* Panel Header */}
          <div className="p-4 bg-black/5 dark:bg-black/35 border-b border-foreground/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Database className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">AI Data Core Database</h3>
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-mono font-semibold">FIRESTORE DIRECT CLUSTERS</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={loadFacts}
                    className="p-1.5 rounded-md hover:bg-white/10 text-muted transition-colors"
                    disabled={factsLoading}
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", factsLoading && "animate-spin")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sync Database</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => {
                      setNewFactCategory('General');
                      setNewFactContent('');
                      setIsAddingFact(true);
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-full flex items-center gap-1 transition-all shadow-md shadow-amber-600/10"
                  >
                    <Plus size={12} />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add Fact Manually</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Database Search & Category Filter */}
          <div className="p-3 bg-black/15 border-b border-foreground/5 space-y-3 shrink-0">
            <div className="relative">
              <TrainingSearchBox onSearch={setSearchQuery} />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[10px]">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1 rounded-full whitespace-nowrap transition-colors border",
                    selectedCategory === cat 
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-900 dark:text-amber-400 font-bold"
                      : "bg-black-deep/60 dark:bg-black/40 border-foreground/15 text-foreground/90 dark:text-muted hover:text-foreground hover:bg-black-deep transition-all"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Facts List Panel */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/15 relative">
            
            {/* Seeding Indicator */}
            {isSeeding && (
              <div className="p-5 text-center text-xs text-muted flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-amber-500" />
                <span>Seeding default Nefron specifications into your Firestore...</span>
              </div>
            )}

            {/* Add Fact Drawer */}
            <AnimatePresence>
              {isAddingFact && (
                <motion.form 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleAddNewFact}
                  className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/25 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">New Fact Configuration</span>
                    <button type="button" onClick={() => setIsAddingFact(false)} className="text-muted hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-muted">Category Class</label>
                    <select 
                      value={newFactCategory}
                      onChange={(e) => setNewFactCategory(e.target.value)}
                      className="w-full text-xs bg-black-deep border border-foreground/15 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
                    >
                      {categories.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-muted">Specification / Content</label>
                    <textarea 
                      placeholder="Enter full specification details..."
                      value={newFactContent}
                      onChange={(e) => setNewFactContent(e.target.value)}
                      rows={3}
                      className="w-full text-xs bg-black-deep border border-foreground/15 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground resize-none"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Check size={14} />
                    <span>Save Fact entry</span>
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* List display */}
            {factsLoading && facts.length === 0 ? (
              <div className="flex flex-col gap-3 px-2 pt-2 pb-20">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : filteredFacts.length === 0 ? (
              <div className="text-center py-20 text-xs text-muted font-mono bg-black-deep/50 rounded-xl border border-foreground/10 mx-2 shadow-inner">
                <div className="mb-2 w-8 h-8 rounded-full bg-black border border-foreground/15 flex items-center justify-center mx-auto">
                   <Search size={14} className="text-muted" />
                </div>
                [EMPTY MATCH] No facts configured matching constraints.
              </div>
            ) : (
              filteredFacts.map(fact => {
                const isEditing = editingFactId === fact.id;
                
                return (
                  <div 
                    key={fact.id}
                    className="p-4 bg-black-deep/80 dark:bg-black/35 rounded-xl border border-foreground/15 hover:border-amber-500/40 transition-all flex flex-col gap-2.5 group relative overflow-hidden shadow-md"
                  >
                    {/* Category Pill Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                        {fact.category}
                      </span>

                      {/* Manual controls */}
                      <div className="flex gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isEditing && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button 
                                  onClick={() => {
                                    setEditingFactId(fact.id);
                                    setEditingContent(fact.content);
                                    setEditingCategory(fact.category);
                                  }}
                                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-muted hover:text-foreground transition-all"
                                >
                                  <Edit3 size={11} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Edit fact</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button 
                                  onClick={() => handleDeleteFact(fact.id)}
                                  className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-500 transition-all"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete fact</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Fact Content Text */}
                    {isEditing ? (
                      <div className="space-y-2 mt-1">
                        <select 
                          value={editingCategory}
                          onChange={(e) => setEditingCategory(e.target.value)}
                          className="w-full text-[11px] bg-black-deep border border-foreground/15 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
                        >
                          {categories.filter(c => c !== 'All').map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <textarea 
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={4}
                          className="w-full text-xs bg-black-deep border border-foreground/15 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground resize-none"
                        />
                        <div className="flex justify-end gap-1.5 text-[10px]">
                          <button 
                            onClick={() => setEditingFactId(null)}
                            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-muted"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleUpdateFact(fact.id)}
                            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12px] leading-relaxed text-foreground/95 dark:text-foreground/90 font-medium select-text selection:bg-amber-500/30 selection:text-white break-words">
                        {fact.content}
                      </p>
                    )}

                    {/* Fact Meta Information */}
                    {!isEditing && (
                      <div className="mt-1 flex items-center justify-between text-[8px] font-mono text-muted/80 dark:text-muted/65 border-t border-foreground/5 pt-1">
                        <span>ID: {fact.id.substring(0, 8)}</span>
                        <span>BY: {fact.updatedBy ? fact.updatedBy.split('@')[0] : 'core'}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT SIDE: ADVANCED TRAINING CHAT CONSOLE */}
        <div className="h-[85vh] lg:h-full w-full lg:w-[60%] flex flex-col bg-gray-dark/95 backdrop-blur-md rounded-2xl border border-foreground/15 overflow-hidden shadow-2xl shrink-0 relative snap-center max-w-5xl mx-auto">
          {/* Chat Panel Header */}
          <div className="p-4 bg-black/5 dark:bg-black/35 border-b border-foreground/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Brain className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-foreground">Knowledge Core Training Console</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[8px] font-mono uppercase text-emerald-700 dark:text-emerald-400 font-semibold truncate max-w-[120px] md:max-w-none">System Link Stable - Root</span>
                </div>
              </div>
            </div>
   
            <div className="text-[8px] md:text-[9px] font-mono border border-foreground/15 bg-cyan-50 dark:bg-black/35 px-2 py-1 rounded-full text-cyan-700 dark:text-cyan-300 font-bold shadow-sm whitespace-nowrap hidden sm:block">
              ADMIN_SESSION: TRUE
            </div>
          </div>

          {/* Messages Stream Scroll area */}
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-x-hidden overflow-y-auto p-3 md:p-4 space-y-6 custom-scrollbar bg-black/10 relative"
          >
            {chatLoading ? (
              <div className="flex flex-col gap-4 pt-4">
                <div className="flex gap-3 max-w-[85%]">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <Skeleton className="h-16 flex-1 rounded-2xl rounded-tl-sm" />
                </div>
                <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <Skeleton className="h-10 flex-1 rounded-2xl rounded-tr-sm" />
                </div>
                <div className="flex gap-3 max-w-[85%]">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <Skeleton className="h-24 flex-1 rounded-2xl rounded-tl-sm" />
                </div>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div 
                  key={msg.id || index}
                  className={cn(
                    "flex gap-2 min-w-0 max-w-full overflow-hidden",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {/* Bot Logo / Avatar */}
                  {msg.role !== 'user' && (
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-cyan-500/20 bg-cyan-950/20 flex items-center justify-center shrink-0 shadow-lg mt-0.5">
                      <Brain size={14} className="text-cyan-400 animate-pulse" />
                    </div>
                  )}

                  {/* Message Bubble Panel */}
                  <div 
                    className={cn(
                      "text-[11px] md:text-xs leading-relaxed max-w-[90%] md:max-w-[85%] rounded-2xl shadow-md min-w-0 flex-1 relative overflow-x-auto",
                      msg.role === 'user'
                        ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-tr-xl rounded-br-sm p-3 md:p-4 whitespace-pre-wrap shrink-0 flex-none self-end max-w-max break-words ml-auto"
                        : "bg-black-deep border border-foreground/15 text-foreground rounded-tl-xl rounded-bl-sm p-3 md:p-4 text-left prose prose-sm prose-invert max-w-full prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:max-w-full font-sans break-words"
                    )}
                  >
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 break-words max-w-full whitespace-pre-line" {...props} />,
                          a: ({node, ...props}) => <a className="text-cyan-500 underline break-all" {...props} />,
                          pre: ({node, ...props}) => <pre className="overflow-x-auto max-w-[80vw] bg-black/50 p-2 rounded-md" {...props} />,
                          code: ({node, ...props}) => <code className="break-words bg-black/30 rounded px-1" {...props} />,
                        }}
                      >{msg.content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* AI Autonomous Thinking Steps logs */}
            {isSending && (
              <div className="space-y-3 min-w-0">
                {/* Spinning Brain thinking bubble */}
                <div className="flex gap-2 items-start max-w-full">
                  <div className="w-7 h-7 border border-cyan-500/20 bg-cyan-950/20 flex items-center justify-center shrink-0 shadow-lg animate-spin-slow rounded-full mt-0.5">
                    <Cpu size={14} className="text-cyan-400 animate-pulse" />
                  </div>
                  
                  <div className="bg-black-deep shadow-md border border-cyan-500/10 px-3 py-2 rounded-xl rounded-tl-sm flex items-center gap-2 max-w-max">
                    <Loader2 className="animate-spin text-cyan-600 dark:text-cyan-400" size={13} />
                    <span className="text-[10px] text-cyan-700 dark:text-cyan-300 font-mono tracking-wide truncate">Resolving core tasks...</span>
                  </div>
                </div>

                {/* Dynamic command terminal logs */}
                {aiThinkingSteps.length > 0 && (
                  <div className="ml-9 md:ml-10 p-2.5 bg-[#0B0C10] border border-emerald-500/20 rounded-xl font-mono text-[8px] md:text-[9px] text-[#39FF14] space-y-1 shadow-inner max-w-[85%] overflow-x-hidden break-words">
                    {aiThinkingSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-1.5 leading-tight break-words">
                        <span className="text-muted/65 select-none shrink-0">&gt;&gt;</span>
                        <p className="flex-1 select-text break-words overflow-hidden">{step}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message Input section */}
          <div className="shrink-0 relative">
            <TrainingInputBox 
              isSending={isSending} 
              onSend={handleSendTrainingMessage} 
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function TrainingInputBox({ isSending, onSend }: { isSending: boolean, onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  
  const handleSend = () => {
    if (!text.trim() || isSending) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="p-4 bg-black/45 border-t border-foreground/10 flex gap-3">
      <input 
        type="text"
        placeholder="Type database commands (e.g. 'Add a mechanical spec about...')"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
             e.preventDefault();
             handleSend();
          }
        }}
        disabled={isSending}
        className="flex-1 text-xs bg-black-deep/75 border border-foreground/10 focus:border-cyan-500 rounded-xl px-4 py-3 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={isSending || !text.trim()}
        className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-md shadow-cyan-600/15 flex items-center gap-1.5 disabled:opacity-50 hover:shadow-lg hover:scale-[1.02] active:scale-95"
      >
        {isSending ? <Loader2 className="animate-spin w-4 h-4" /> : <Send size={14} />}
      </button>
    </div>
  );
}

function TrainingSearchBox({ onSearch }: { onSearch: (val: string) => void }) {
  const [text, setText] = useState('');

  // Use a short debounce to avoid freezing the UI on rapid keystrokes for large lists
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(text);
    }, 150);
    return () => clearTimeout(timer);
  }, [text, onSearch]);

  return (
    <>
      <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
      <input 
        type="text"
        placeholder="Search facts..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full text-xs bg-black-deep/40 border border-foreground/10 rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
      />
    </>
  );
}


