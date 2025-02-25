"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
  RefObject
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Copy,
  Trash2,
  Send,
  BookOpen,
  Grid2X2,
  Columns,
  Square,
  MessageSquare,
  Loader2,
  Timer,
  Bot,
  Sparkles,
  SmilePlus,
  Check,
  FileText,
  Paperclip,
  X,
  Globe2
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/sidebar-context";
import { useData, ChatModel } from "@/components/data-context";
import { PromptSelector } from "@/components/prompt-selector";
import { ComplexPromptModal } from "@/components/complex-prompt-modal";
import { addToScratchPad as addToScratchPadService } from "@/utils/scratch-pad-service";
import {
  OpenAIIcon,
  AnthropicIcon,
  GeminiIcon,
  PerplexityIcon,
  MistralIcon,
  MetaIcon,
  ZephyrIcon,
} from "@/components/icons/ai-provider-icons";
import { useSession } from "@/app/utils/session/session";
import { useSupabase } from "@/app/contexts/SupabaseContext";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/lib/Dashboard";
import { UploadService, type UploadedFile } from "@/utils/upload-service";
import { FileUploadPills } from "@/components/file-upload-pills";
import { KnowledgeBaseSelector } from "@/components/knowledge-base-selector";
import { KnowledgeBase, fetchKnowledgeBases } from "@/utils/knowledge-base-service";
import { fetchAssets } from "@/utils/asset-service";
import { Asset } from "@/types/knowledge-base";
import { useRouter, useSearchParams } from "next/navigation";
import ChatMessage from "@/components/chat-message";
import { AppSidebar } from "@/components/app-sidebar";

// Uppy CSS
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

// Basic shape of a message
interface Message {
  role: "user" | "assistant";
  content: string;
}

function ChatContent() {
  const { sidebarOpen } = useSidebar();
  const { promptTemplates: prompts, categories, chatModels: allChatModels, personas } = useData();
  const { session, getApiHeaders } = useSession();
  const supabase = useSupabase();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Chat messages for each window
  const [messages, setMessages] = useState<Message[]>([]);
  const [messages2, setMessages2] = useState<Message[]>([]);
  const [messages3, setMessages3] = useState<Message[]>([]);
  const [messages4, setMessages4] = useState<Message[]>([]);

  // Overall user input & state
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mode, setMode] = useState<"single" | "dual" | "quad">("single");
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<any | null>(null);

  // Per-window streaming states (so each loader can appear independently)
  const [isStreaming1, setIsStreaming1] = useState(false);
  const [isStreaming2, setIsStreaming2] = useState(false);
  const [isStreaming3, setIsStreaming3] = useState(false);
  const [isStreaming4, setIsStreaming4] = useState(false);

  // Per-window container refs
  const chatContainerRef1 = useRef<HTMLDivElement>(null);
  const chatContainerRef2 = useRef<HTMLDivElement>(null);
  const chatContainerRef3 = useRef<HTMLDivElement>(null);
  const chatContainerRef4 = useRef<HTMLDivElement>(null);
  
  // Create message end refs for each window at the top level
  const messagesEndRef1 = useRef<HTMLDivElement>(null);
  const messagesEndRef2 = useRef<HTMLDivElement>(null);
  const messagesEndRef3 = useRef<HTMLDivElement>(null);
  const messagesEndRef4 = useRef<HTMLDivElement>(null);

  // Model & persona selection
  const [selectedModels, setSelectedModels] = useState<{ [key: string]: string }>({});
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: string]: string }>({
    chat1: "default",
    chat2: "default",
    chat3: "default",
    chat4: "default",
  });

  // For conversation tracking
  const [conversationIds, setConversationIds] = useState<{ [key: string]: string }>({});
  const [multiConversationId, setMultiConversationId] = useState<string | null>(null);

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const uppyRef = useRef<Uppy | null>(null);

  // Knowledge base
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true);

  // SSE fallback / retry logic
  const [retryAttempts, setRetryAttempts] = useState<{ [key: string]: number }>({});

  // Web search toggle
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);

  // --------------------------------------------
  // Uppy File Upload
  // --------------------------------------------
  useEffect(() => {
    if (!uppyRef.current) {
      const uppyInstance = UploadService.createUppy(
        "chat-uploader",
        {
          maxFiles: 1,
          storageFolder: "chats",
          storageBucket: "amaruai-dev",
        },
        (file) => {
          setUploadedFiles((prev) => [
            ...prev,
            {
              id: file.id,
              name: file.name,
              type: file.type,
              size: file.size,
              uploadURL: file.uploadURL,
            },
          ]);
        },
        () => {
          setShowUploadModal(false);
        },
        supabase
      );
      uppyRef.current = uppyInstance;
    }
    return () => {
      if (uppyRef.current) {
        uppyRef.current.cancelAll();
      }
    };
  }, [supabase]);

  const handleFileUpload = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      const uploadedFile: UploadedFile = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadURL: file.uploadURL,
      };
      setUploadedFiles((prev) => [...prev, uploadedFile]);
    }
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
    }
  };

  const handleRemoveFile = (file: UploadedFile) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== file.name));
  };

  // --------------------------------------------
  // Knowledge Base
  // --------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = await getApiHeaders();
        if (!headers) return;
        setIsLoadingKnowledgeBases(true);
        const fetchedKnowledgeBases = await fetchKnowledgeBases(headers);
        setKnowledgeBases(fetchedKnowledgeBases);
      } catch (error) {
        console.error("Error fetching knowledge bases:", error);
      } finally {
        setIsLoadingKnowledgeBases(false);
      }
    };
    fetchData();
  }, [getApiHeaders]);

  const loadAssets = useCallback(async () => {
    try {
      const headers = await getApiHeaders();
      if (!headers) return;
      const assets = await fetchAssets(headers);
      setAssets(assets);
    } catch (error) {
      console.error("Error loading assets:", error);
    }
  }, [getApiHeaders]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // --------------------------------------------
  // Handle default/selected models
  // --------------------------------------------
  useEffect(() => {
    if (allChatModels?.length > 0) {
      const defaultModel = allChatModels.find((m) => m.default);
      if (!defaultModel) return;

      // Up to 3 "other" models
      const otherModels = allChatModels
        .filter((m) => !m.default && m.id !== defaultModel.id)
        .slice(0, 3);

      setSelectedModels((prev) => ({
        ...prev,
        chat1: defaultModel.id,
        ...(mode !== "single" && otherModels[0] && { chat2: otherModels[0].id }),
        ...(mode === "quad" && otherModels[1] && { chat3: otherModels[1].id }),
        ...(mode === "quad" && otherModels[2] && { chat4: otherModels[2].id }),
      }));
    }
  }, [allChatModels, mode]);

  // If URL has ?model=..., prefer that for chat1
  useEffect(() => {
    const modelId = searchParams.get("model");
    if (modelId && allChatModels?.some((m) => m.id === modelId)) {
      setSelectedModels((prev) => ({ ...prev, chat1: modelId }));
    }
  }, [searchParams, allChatModels]);

  // For debugging persona changes
  useEffect(() => {
    console.log("Personas changed:", personas);
  }, [personas]);

  // --------------------------------------------
  // Helper: pick a provider icon from name
  // --------------------------------------------
  const getProviderIcon = (modelId: string, modelName: string) => {
    const nameLower = modelName.toLowerCase();
    if (nameLower.includes("gpt") || nameLower.includes("o1")) return OpenAIIcon;
    if (nameLower.includes("claude")) return AnthropicIcon;
    if (nameLower.includes("gemini")) return GeminiIcon;
    if (nameLower.includes("perplexity")) return PerplexityIcon;
    if (nameLower.includes("mistral") || nameLower.includes("mixtral")) return MistralIcon;
    if (nameLower.includes("llama")) return MetaIcon;
    if (nameLower.includes("zephyr")) return ZephyrIcon;
    return MessageSquare;
  };

  // --------------------------------------------
  // Per-window persona/model changes
  // --------------------------------------------
  const handleModelChange = (chatWindowId: string, modelId: string) => {
    setSelectedModels((prev) => ({ ...prev, [chatWindowId]: modelId }));
    // reset retry attempt
    setRetryAttempts((prev) => ({ ...prev, [chatWindowId]: 0 }));
  };

  const handlePersonaChange = (chatWindowId: string, personaId: string) => {
    setSelectedPersonas((prev) => ({ ...prev, [chatWindowId]: personaId }));
  };

  // Grab the model name from the ID
  const getModelName = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId];
    const model = allChatModels?.find((m) => m.id === modelId);
    return model?.name || "Default Model";
  };

  // Grab the model icon from the ID
  const getModelIcon = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId];
    const model = allChatModels?.find((m) => m.id === modelId);
    return model ? getProviderIcon(model.id, model.name) : Timer;
  };

  // --------------------------------------------
  // SSE call for each chat window
  // --------------------------------------------
  async function makeApiCall(
    prevMessagesLocal: Message[],
    setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>,
    chatId: string,
    isRetry = false
  ) {
    // Decide which streaming state to update
    let setStreaming = setIsStreaming1;
    if (chatId === "chat2") setStreaming = setIsStreaming2;
    else if (chatId === "chat3") setStreaming = setIsStreaming3;
    else if (chatId === "chat4") setStreaming = setIsStreaming4;

    // If retry, ensure we don't exceed 1
    if (isRetry) {
      const currentRetries = retryAttempts[chatId] || 0;
      if (currentRetries > 0) {
        console.log(`Already retried chat ${chatId}, skipping further retries`);
        return;
      }
      setRetryAttempts((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || 0) + 1,
      }));
    }

    try {
      setStreaming(true);

      let currentConversationId = conversationIds[chatId];
      if (!currentConversationId) {
        currentConversationId = crypto.randomUUID();
        setConversationIds((prev) => ({ ...prev, [chatId]: currentConversationId }));
      }

      const modelId = isRetry ? undefined : selectedModels[chatId];
      const personaId = selectedPersonas[chatId];
      const selectedModel = modelId
        ? allChatModels?.find((m) => m.id === modelId)
        : undefined;
      const selectedPersona = personas?.find((p) => p.id.toString() === personaId);

      let streamStartTime: number | null = null;
      let receivedFirstChunk = false;
      let hasReceivedContent = false;
      let chunkCount = 0;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getApiHeaders()),
        },
        body: JSON.stringify({
          messages: [...prevMessagesLocal],
          user_id: session?.user?.id,
          model_id: selectedModel?.id,
          persona_id: selectedPersona?.id,
          files: uploadedFiles.map((f) => ({ name: f.name, url: f.uploadURL })),
          conversation_id: currentConversationId,
          knowledge_base_ids: selectedKnowledgeBases.map((kb) => kb.id),
          asset_ids: selectedAssets.map((asset) => asset.id),
          ...(multiConversationId && { multi_conversation_id: multiConversationId }),
          web: isWebSearchEnabled,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantMessage = "";
      let hasCreatedAssistantMessage = false;
      streamStartTime = Date.now();

      while (true) {
        const timeElapsed = Date.now() - (streamStartTime ?? 0);
        if (
          timeElapsed > 10000 &&
          (!receivedFirstChunk || (chunkCount === 1 && !hasReceivedContent))
        ) {
          throw new Error("Stream timeout - no meaningful content received within 10 seconds");
        }

        const { value, done } = await reader.read();
        if (done) {
          if (chunkCount > 0 && !hasReceivedContent) {
            throw new Error("Stream completed with only empty chunks");
          }
          break;
        }

        if (!receivedFirstChunk) receivedFirstChunk = true;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            chunkCount++;
            const jsonData = line.slice(5).trim();
            if (jsonData === "[DONE]") continue;

            try {
              // basic check for incomplete JSON
              const openBraces = (jsonData.match(/{/g) || []).length;
              const closeBraces = (jsonData.match(/}/g) || []).length;
              if (
                openBraces !== closeBraces ||
                (openBraces > 0 && !jsonData.trim().endsWith("}"))
              ) {
                console.warn("Skipping incomplete JSON chunk:", jsonData);
                continue;
              }

              const parsed = JSON.parse(jsonData);
              if (parsed.choices?.[0]?.delta?.content) {
                hasReceivedContent = true;
                assistantMessage += parsed.choices[0].delta.content;

                if (!hasCreatedAssistantMessage) {
                  hasCreatedAssistantMessage = true;
                  setMessagesFunction((prev) => [
                    ...prev,
                    { role: "assistant", content: assistantMessage },
                  ]);
                } else {
                  setMessagesFunction((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: assistantMessage,
                    };
                    return updated;
                  });
                }
              }
            } catch (parseErr) {
              console.warn("Error parsing chunk, skipping:", parseErr);
              console.warn("Problematic chunk:", jsonData);
              continue;
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Error in API call:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";

      // Retry once if we get a "timeout" or "empty chunk"
      if ((errMsg.includes("timeout") || errMsg.includes("empty chunk")) && !isRetry) {
        console.log("Retrying stream without specific model for", chatId);
        try {
          await makeApiCall(prevMessagesLocal, setMessagesFunction, chatId, true);
        } catch (retryErr) {
          console.error("Retry also failed:", retryErr);
          const retryErrMsg = retryErr instanceof Error ? retryErr.message : "Unknown error";
          setError(
            (prevError) =>
              prevError
                ? new Error(`${prevError.message}\nRetry failed: ${retryErrMsg}`)
                : new Error(`Retry failed: ${retryErrMsg}`)
          );
        }
      } else {
        setError(
          (prevError) =>
            prevError ? new Error(`${prevError.message}\n${errMsg}`) : new Error(errMsg)
        );
      }
    } finally {
      setStreaming(false);
    }
  }

  // --------------------------------------------
  // Submit user input
  // --------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);
    resetRetryAttempts();

    // Add user msg to all windows
    const newMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, newMessage]);
    setMessages2((prev) => [...prev, newMessage]);
    setMessages3((prev) => [...prev, newMessage]);
    setMessages4((prev) => [...prev, newMessage]);
    setInput("");

    // For multi-conversation grouping
    let currentMultiConversationId = multiConversationId;
    if ((mode === "dual" || mode === "quad") && !currentMultiConversationId) {
      currentMultiConversationId = crypto.randomUUID();
      setMultiConversationId(currentMultiConversationId);
    }

    // Fire SSE calls
    const calls = [
      makeApiCall(messages, setMessages, "chat1"),
      mode !== "single" && makeApiCall(messages2, setMessages2, "chat2"),
      mode === "quad" && makeApiCall(messages3, setMessages3, "chat3"),
      mode === "quad" && makeApiCall(messages4, setMessages4, "chat4"),
    ].filter(Boolean);

    try {
      const results = await Promise.allSettled(calls);
      // Log any failures
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const chatId = ["chat1", "chat2", "chat3", "chat4"][i];
          console.error(`Chat ${chatId} failed:`, r.reason);
          const errMsg =
            r.reason instanceof Error ? r.reason.message : "Unknown error";
          setError(
            (prevError) =>
              prevError
                ? new Error(`${prevError.message}\nChat ${chatId}: ${errMsg}`)
                : new Error(`Chat ${chatId}: ${errMsg}`)
          );
        }
      });
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setError((prev) => (prev ? new Error(`${prev.message}\n${errMsg}`) : new Error(errMsg)));
    } finally {
      setIsLoading(false);
      setUploadedFiles([]);
    }
  };

  // --------------------------------------------
  // Basic housekeeping
  // --------------------------------------------
  const resetRetryAttempts = () => {
    setRetryAttempts({});
  };

  const handleModeChange = (newMode: "single" | "dual" | "quad") => {
    setMode(newMode);
    const defaultModel = allChatModels?.find((m) => m.default);
    const otherModels = allChatModels
      ?.filter((m) => !m.default && m.id !== defaultModel?.id)
      .slice(0, 3);

    if (defaultModel) {
      const newSelections: { [key: string]: string } = {
        chat1: defaultModel.id,
      };
      if (newMode !== "single" && otherModels?.[0]) {
        newSelections.chat2 = otherModels[0].id;
      }
      if (newMode === "quad") {
        if (otherModels?.[1]) newSelections.chat3 = otherModels[1].id;
        if (otherModels?.[2]) newSelections.chat4 = otherModels[2].id;
      }
      setSelectedModels(newSelections);
    }
    resetRetryAttempts();
    setMultiConversationId(null);
  };

  const handleToggleChatbot = (modelId: string) => {
    router.push(`/chat?model=${modelId}`, { scroll: false });
    setSelectedModels((prev) => ({ ...prev, chat1: modelId }));
  };

  // Copy entire conversation
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedStates((prev) => ({ ...prev, [content]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [content]: false }));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Add conversation to scratch pad
  const addToScratchPad = async (content: string) => {
    try {
      await addToScratchPadService(content);
    } catch (err) {
      console.error("Failed to add to scratch pad:", err);
    }
  };

  // Clear an individual chat window
  const clearConversation = (messagesList: Message[]) => {
    if (messagesList === messages) {
      setMessages([]);
    } else if (messagesList === messages2) {
      setMessages2([]);
    } else if (messagesList === messages3) {
      setMessages3([]);
    } else if (messagesList === messages4) {
      setMessages4([]);
    }
  };

  // For prompt selection
  const handlePromptSelect = (prompt: any) => {
    if (prompt.is_complex) {
      setSelectedComplexPrompt(prompt);
    } else {
      setInput((prev) => {
        const prefix = prev ? prev + " " : "";
        const promptText = typeof prompt.prompt === "string" ? prompt.prompt : "";
        return prefix + promptText;
      });
    }
  };

  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    setInput((prev) => (prev ? prev + " " : "") + generatedPrompt);
    setSelectedComplexPrompt(null);
  };

  // --------------------------------------------
  // The updated ChatWindow sub-component
  // --------------------------------------------
  interface ChatWindowProps {
    messages: Message[];
    messagesEndRef: RefObject<HTMLDivElement>;
    title: string;
    Icon: React.ComponentType<any>;
    onCopy: () => void;
    onAddToScratchPad: () => void;
    onClearConversation: () => void;
    isCopied: boolean;
    chatWindowId: string;
    isStreaming: boolean; 
    containerRef: RefObject<HTMLDivElement>;

    // Additional props so ChatWindow can pick up personas/models
    personas: any[] | undefined;
    selectedPersonas: { [key: string]: string };
    selectedModels: { [key: string]: string };
    handlePersonaChange: (chatWindowId: string, personaId: string) => void;
    handleModelChange: (chatWindowId: string, modelId: string) => void;
    getModelIcon: (chatWindowId: string) => React.ComponentType<any>;
    getModelName: (chatWindowId: string) => string;
  }

  function ChatWindow({
    messages,
    messagesEndRef,
    title,
    Icon,
    onCopy,
    onAddToScratchPad,
    onClearConversation,
    isCopied,
    chatWindowId,
    isStreaming,
    containerRef,

    // pass these so the window can manage persona/model selection
    personas,
    selectedPersonas,
    selectedModels,
    handlePersonaChange,
    handleModelChange,
    getModelIcon,
    getModelName,
  }: ChatWindowProps) {
    const shouldAutoScrollRef = useRef(true);

    // Auto-scroll if near bottom
    useEffect(() => {
      if (!containerRef.current) return;
      if (shouldAutoScrollRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [messages, containerRef]);

    // On scroll, check if user is near bottom
    const handleScroll = useCallback(() => {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

      // If user is within 100px, auto-scroll
      shouldAutoScrollRef.current = distanceFromBottom < 100;
    }, [containerRef]);

    // Which persona for this window
    const selectedPersona = personas?.find(
      (p) => p.id.toString() === selectedPersonas[chatWindowId]
    );

    return (
      <TooltipProvider>
        <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden relative">
          {/* Header (model + persona + copy, etc.) */}
          <div className="flex items-center justify-between p-3 border-b">
            {/* Left side: model info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {React.createElement(getModelIcon(chatWindowId), { className: "w-5 h-5" })}
                <span className="font-medium">{getModelName(chatWindowId)}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Persona dropdown */}
                <Select
                  value={selectedPersonas[chatWindowId]}
                  onValueChange={(value) => handlePersonaChange(chatWindowId, value)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    {personas?.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id.toString()}>
                        {persona.role || "Default"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Model dropdown */}
                <Select
                  value={selectedModels[chatWindowId]}
                  onValueChange={(value) => handleModelChange(chatWindowId, value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={title} />
                  </SelectTrigger>
                  <SelectContent>
                    {allChatModels?.map((model: ChatModel) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right side: copy, scratch pad, clear */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onCopy}>
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isCopied ? "Copied!" : "Copy chat content"}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={onAddToScratchPad}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Scratch Pad</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={onClearConversation}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear Conversation</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Scrollable area with an onScroll handler */}
          <ScrollArea
            className="flex-1 p-4"
            ref={containerRef}
            onScroll={handleScroll}
          >
            <div className="space-y-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  role={message.role}
                  content={message.content}
                  avatar={message.role === "assistant" ? selectedPersona?.avatar : null}
                />
              ))}
              {/* anchor to scroll into view */}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </ScrollArea>

          {/* Absolutely-positioned loader so it doesn't shift messages */}
          {isStreaming && (
            <div className="absolute bottom-4 left-0 w-full flex justify-center pointer-events-none">
              <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-muted-foreground pointer-events-auto">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating response...</span>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // --------------------------------------------
  // Render
  // --------------------------------------------
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-64 h-full border-r border-gray-200">
        <AppSidebar toggleChatbot={handleToggleChatbot} />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex-1 overflow-auto p-4">
          {mode === "single" ? (
            <div className="grid h-full gap-4" style={{ gridTemplateColumns: "1fr" }}>
              <ChatWindow
                messages={messages}
                messagesEndRef={messagesEndRef1}
                title="Perplexity Llama"
                Icon={Timer}
                onCopy={() =>
                  copyToClipboard(messages.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onAddToScratchPad={() =>
                  addToScratchPad(messages.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onClearConversation={() => clearConversation(messages)}
                isCopied={copiedStates[messages.map((m) => `${m.role}: ${m.content}`).join("\n")]}
                chatWindowId="chat1"
                isStreaming={isStreaming1}
                containerRef={chatContainerRef1}
                personas={personas}
                selectedPersonas={selectedPersonas}
                selectedModels={selectedModels}
                handlePersonaChange={handlePersonaChange}
                handleModelChange={handleModelChange}
                getModelIcon={getModelIcon}
                getModelName={getModelName}
              />
            </div>
          ) : (
            <div
              className="grid h-full gap-4"
              style={{
                gridTemplateColumns: mode === "dual" ? "1fr 1fr" : "1fr 1fr",
                gridTemplateRows: mode === "quad" ? "1fr 1fr" : "1fr",
              }}
            >
              {/* Window 1 */}
              <ChatWindow
                messages={messages}
                messagesEndRef={messagesEndRef1}
                title="Perplexity Llama"
                Icon={Timer}
                onCopy={() =>
                  copyToClipboard(messages.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onAddToScratchPad={() =>
                  addToScratchPad(messages.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onClearConversation={() => clearConversation(messages)}
                isCopied={copiedStates[messages.map((m) => `${m.role}: ${m.content}`).join("\n")]}
                chatWindowId="chat1"
                isStreaming={isStreaming1}
                containerRef={chatContainerRef1}
                personas={personas}
                selectedPersonas={selectedPersonas}
                selectedModels={selectedModels}
                handlePersonaChange={handlePersonaChange}
                handleModelChange={handleModelChange}
                getModelIcon={getModelIcon}
                getModelName={getModelName}
              />

              {/* Window 2 (already knows it's not single mode) */}
              <ChatWindow
                messages={messages2}
                messagesEndRef={messagesEndRef2}
                title="GPT-4o"
                Icon={Sparkles}
                onCopy={() =>
                  copyToClipboard(messages2.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onAddToScratchPad={() =>
                  addToScratchPad(messages2.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onClearConversation={() => clearConversation(messages2)}
                isCopied={
                  copiedStates[messages2.map((m) => `${m.role}: ${m.content}`).join("\n")]
                }
                chatWindowId="chat2"
                isStreaming={isStreaming2}
                containerRef={chatContainerRef2}
                personas={personas}
                selectedPersonas={selectedPersonas}
                selectedModels={selectedModels}
                handlePersonaChange={handlePersonaChange}
                handleModelChange={handleModelChange}
                getModelIcon={getModelIcon}
                getModelName={getModelName}
              />

              {/* Window 3 & 4 only if quad */}
              {mode === "quad" && (
                <>
                  <ChatWindow
                    messages={messages3}
                    messagesEndRef={messagesEndRef3}
                    title="Gemini 1.5 Pro"
                    Icon={Bot}
                    onCopy={() =>
                      copyToClipboard(messages3.map((m) => `${m.role}: ${m.content}`).join("\n"))
                    }
                    onAddToScratchPad={() =>
                      addToScratchPad(messages3.map((m) => `${m.role}: ${m.content}`).join("\n"))
                    }
                    onClearConversation={() => clearConversation(messages3)}
                    isCopied={
                      copiedStates[messages3.map((m) => `${m.role}: ${m.content}`).join("\n")]
                    }
                    chatWindowId="chat3"
                    isStreaming={isStreaming3}
                    containerRef={chatContainerRef3}
                    personas={personas}
                    selectedPersonas={selectedPersonas}
                    selectedModels={selectedModels}
                    handlePersonaChange={handlePersonaChange}
                    handleModelChange={handleModelChange}
                    getModelIcon={getModelIcon}
                    getModelName={getModelName}
                  />

                  <ChatWindow
                    messages={messages4}
                    messagesEndRef={messagesEndRef4}
                    title="Meta Llama 3.1"
                    Icon={SmilePlus}
                    onCopy={() =>
                      copyToClipboard(messages4.map((m) => `${m.role}: ${m.content}`).join("\n"))
                    }
                    onAddToScratchPad={() =>
                      addToScratchPad(messages4.map((m) => `${m.role}: ${m.content}`).join("\n"))
                    }
                    onClearConversation={() => clearConversation(messages4)}
                    isCopied={
                      copiedStates[messages4.map((m) => `${m.role}: ${m.content}`).join("\n")]
                    }
                    chatWindowId="chat4"
                    isStreaming={isStreaming4}
                    containerRef={chatContainerRef4}
                    personas={personas}
                    selectedPersonas={selectedPersonas}
                    selectedModels={selectedModels}
                    handlePersonaChange={handlePersonaChange}
                    handleModelChange={handleModelChange}
                    getModelIcon={getModelIcon}
                    getModelName={getModelName}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer: input, mode toggles, etc. */}
        <div className="border-t p-4 flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <PromptSelector prompts={prompts} categories={categories} onSelectPrompt={handlePromptSelect}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </PromptSelector>
              </TooltipTrigger>
              <TooltipContent>
                <p>Prompts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Attachment</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <KnowledgeBaseSelector
                  knowledgeBases={knowledgeBases}
                  isLoadingKnowledgeBases={isLoadingKnowledgeBases}
                  selectedKnowledgeBases={selectedKnowledgeBases}
                  selectedAssets={selectedAssets}
                  onSelectKnowledgeBase={(kb) => {
                    setSelectedKnowledgeBases([...selectedKnowledgeBases, kb]);
                  }}
                  onDeselectKnowledgeBase={(kb) => {
                    setSelectedKnowledgeBases(
                      selectedKnowledgeBases.filter((k) => k.id !== kb.id)
                    );
                  }}
                  onSelectAsset={(asset) => {
                    setSelectedAssets([...selectedAssets, asset]);
                  }}
                  onDeselectAsset={(asset) => {
                    setSelectedAssets(selectedAssets.filter((a) => a.id !== asset.id));
                  }}
                />
              </TooltipTrigger>
              <TooltipContent className="bg-white">
                <p>Add Knowledge Base or Asset</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                    className={isWebSearchEnabled ? "text-green-500" : ""}
                  >
                    <Globe2 className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white">
                  <p>Enable Web Search</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type a message..."
            className="flex-1"
          />

          <Button
            onClick={(e) => handleSubmit(e)}
            disabled={isLoading || (!input.trim() && !uploadedFiles.length)}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant={mode === "single" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleModeChange("single")}
              title="Single chat"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={mode === "dual" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleModeChange("dual")}
              title="Split view"
            >
              <Columns className="h-4 w-4" />
            </Button>
            <Button
              variant={mode === "quad" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleModeChange("quad")}
              title="Grid view"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* File upload pills (show if any files) */}
        {uploadedFiles.length > 0 && (
          <div className="absolute bottom-[72px] left-0 right-0 p-2 bg-background border-t">
            <FileUploadPills files={uploadedFiles} onRemove={handleRemoveFile} />
          </div>
        )}
      </div>

      {/* Complex Prompt Modal */}
      {selectedComplexPrompt && (
        <ComplexPromptModal
          prompt={selectedComplexPrompt}
          isOpen={!!selectedComplexPrompt}
          onClose={() => setSelectedComplexPrompt(null)}
          onSubmit={handleComplexPromptSubmit}
        />
      )}

      {/* File Upload Modal */}
      {showUploadModal && uppyRef.current && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Upload Files</h2>
              <Button variant="ghost" size="icon" onClick={handleCloseUploadModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Dashboard uppy={uppyRef.current} plugins={[]} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
}
