"use client";

import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import ReactMarkdown from "react-markdown";
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
  Database,
  ChevronDown,
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
import { isMarkdown } from "@/app/utils/isMarkdown";
import { AppSidebar } from "@/components/app-sidebar";
import { useSidebar } from "@/components/sidebar-context";
import { PromptSelector } from "@/components/prompt-selector";
import { useData } from "@/components/data-context";
import { addToScratchPad as addToScratchPadService } from "@/utils/scratch-pad-service";
import { ComplexPromptModal } from "@/components/complex-prompt-modal";
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
import { ChatModel } from "@/components/data-context";
import { useRouter, useSearchParams } from "next/navigation";
import ChatMessage from "@/components/chat-message";

// Uppy CSS
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

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

  // -- All your message states (unchanged) --
  const [messages, setMessages] = useState<Message[]>([]);
  const [messages2, setMessages2] = useState<Message[]>([]);
  const [messages3, setMessages3] = useState<Message[]>([]);
  const [messages4, setMessages4] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mode, setMode] = useState<"single" | "dual" | "quad">("single");
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [selectedComplexPrompt, setSelectedComplexPrompt] = useState<any | null>(null);

  // -- NEW: Each chat has its own isStreaming state --
  const [isStreaming1, setIsStreaming1] = useState(false);
  const [isStreaming2, setIsStreaming2] = useState(false);
  const [isStreaming3, setIsStreaming3] = useState(false);
  const [isStreaming4, setIsStreaming4] = useState(false);

  // -- Each chat has its own scroll ref --
  const chatContainerRef1 = useRef<HTMLDivElement>(null);
  const chatContainerRef2 = useRef<HTMLDivElement>(null);
  const chatContainerRef3 = useRef<HTMLDivElement>(null);
  const chatContainerRef4 = useRef<HTMLDivElement>(null);

  const [selectedModels, setSelectedModels] = useState<{ [key: string]: string }>({});
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: string]: string }>({
    chat1: "default",
    chat2: "default",
    chat3: "default",
    chat4: "default",
  });

  const [conversationIds, setConversationIds] = useState<{ [key: string]: string }>({});
  const [multiConversationId, setMultiConversationId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(true);
  const [retryAttempts, setRetryAttempts] = useState<{ [key: string]: number }>({});
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false);

  // Uppy for file uploads
  const uppyRef = useRef<Uppy | null>(null);

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

  // Load knowledge bases
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

  // Load default models on mount / when mode changes
  useEffect(() => {
    if (allChatModels?.length > 0) {
      const defaultModel = allChatModels.find((model) => model.default);
      if (!defaultModel) return;

      // Grab up to 3 "other" models for dual/quad
      const otherModels = allChatModels
        .filter((model) => !model.default && model.id !== defaultModel.id)
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

  // If there's a `model` query param, select that for chat1
  useEffect(() => {
    const modelId = searchParams.get("model");
    if (modelId && allChatModels?.some((model) => model.id === modelId)) {
      setSelectedModels((prev) => ({
        ...prev,
        chat1: modelId,
      }));
    }
  }, [searchParams, allChatModels]);

  // For debugging: see if the persona array updates
  useEffect(() => {
    console.log("Personas changed:", personas);
  }, [personas]);

  // Helper to get the correct provider icon
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

  const handleModelChange = (chatWindowId: string, modelId: string) => {
    setSelectedModels((prev) => ({ ...prev, [chatWindowId]: modelId }));
    // Reset any retry attempts for that window
    setRetryAttempts((prev) => ({ ...prev, [chatWindowId]: 0 }));
  };

  const handlePersonaChange = (chatWindowId: string, personaId: string) => {
    setSelectedPersonas((prev) => ({ ...prev, [chatWindowId]: personaId }));
  };

  const getModelName = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId];
    const model = allChatModels?.find((m) => m.id === modelId);
    return model?.name || "Default Model";
  };

  const getModelIcon = (chatWindowId: string) => {
    const modelId = selectedModels[chatWindowId];
    const model = allChatModels?.find((m) => m.id === modelId);
    return model ? getProviderIcon(model.id, model.name) : Timer;
  };

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
  // Updated makeApiCall uses per-window streaming states
  // --------------------------------------------
  const makeApiCall = async (
    prevMessagesLocal: Message[],
    setMessagesFunction: React.Dispatch<React.SetStateAction<Message[]>>,
    chatId: string,
    isRetry: boolean = false
  ) => {
    // Decide which setIsStreaming to use
    let setStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    if (chatId === "chat1") setStreaming = setIsStreaming1;
    else if (chatId === "chat2") setStreaming = setIsStreaming2;
    else if (chatId === "chat3") setStreaming = setIsStreaming3;
    else setStreaming = setIsStreaming4;

    // Check how many times we've retried
    if (isRetry) {
      const currentRetries = retryAttempts[chatId] || 0;
      if (currentRetries > 0) {
        console.log(`Already retried chat ${chatId}, skipping further retries`);
        return;
      }
      // Mark this chat window as having been retried
      setRetryAttempts((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || 0) + 1,
      }));
    }

    try {
      setStreaming(true); // <-- streaming ON

      // Grab or create conversation_id
      let currentConversationId = conversationIds[chatId];
      if (!currentConversationId) {
        currentConversationId = crypto.randomUUID();
        setConversationIds((prev) => ({
          ...prev,
          [chatId]: currentConversationId,
        }));
      }

      // Model & persona
      const modelId = isRetry ? undefined : selectedModels[chatId];
      const personaId = selectedPersonas[chatId];
      const selectedModel = modelId
        ? allChatModels?.find((model) => model.id === modelId)
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

      // SSE loop
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

        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            chunkCount++;
            const jsonData = line.slice(5).trim();
            if (jsonData === "[DONE]") continue;

            try {
              // Basic check for incomplete JSON
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
            } catch (parseError) {
              console.warn("Error parsing chunk, skipping:", parseError);
              console.warn("Problematic chunk:", jsonData);
              continue;
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Error in API call:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";

      // If timeout or empty chunk, retry once without model_id
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
      setStreaming(false); // <-- streaming OFF
    }
  };

  // Submit user input to all windows
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);
    resetRetryAttempts();

    const newMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, newMessage]);
    setMessages2((prev) => [...prev, newMessage]);
    setMessages3((prev) => [...prev, newMessage]);
    setMessages4((prev) => [...prev, newMessage]);
    setInput("");

    let currentMultiConversationId = multiConversationId;
    if ((mode === "dual" || mode === "quad") && !currentMultiConversationId) {
      currentMultiConversationId = crypto.randomUUID();
      setMultiConversationId(currentMultiConversationId);
    }

    const calls = [
      makeApiCall(messages, setMessages, "chat1"),
      mode !== "single" && makeApiCall(messages2, setMessages2, "chat2"),
      mode === "quad" && makeApiCall(messages3, setMessages3, "chat3"),
      mode === "quad" && makeApiCall(messages4, setMessages4, "chat4"),
    ].filter(Boolean);

    try {
      const results = await Promise.allSettled(calls);
      // Log any failed calls
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const chatId = ["chat1", "chat2", "chat3", "chat4"][index];
          console.error(`Chat ${chatId} failed:`, result.reason);
          const errMsg =
            result.reason instanceof Error ? result.reason.message : "Unknown error";
          setError(
            (prevError) =>
              prevError
                ? new Error(`${prevError.message}\nChat ${chatId}: ${errMsg}`)
                : new Error(`Chat ${chatId}: ${errMsg}`)
          );
        }
      });
    } catch (err: unknown) {
      console.error("Error in handleSubmit:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setError((prevError) => (prevError ? new Error(`${prevError.message}\n${errMsg}`) : new Error(errMsg)));
    } finally {
      setIsLoading(false);
      setUploadedFiles([]);
    }
  };

  // Copy & scratch pad
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

  const addToScratchPad = async (content: string) => {
    try {
      await addToScratchPadService(content);
    } catch (err) {
      console.error("Failed to add to scratch pad:", err);
    }
  };

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

  const handlePromptSelect = (prompt: any) => {
    if (prompt.is_complex) {
      setSelectedComplexPrompt(prompt);
    } else {
      setInput((prevInput) => {
        const prefix = prevInput ? prevInput + " " : "";
        const promptText = typeof prompt.prompt === "string" ? prompt.prompt : "";
        return prefix + promptText;
      });
    }
  };

  const handleComplexPromptSubmit = (generatedPrompt: string) => {
    setInput((prevInput) => (prevInput ? prevInput + " " : "") + generatedPrompt);
    setSelectedComplexPrompt(null);
  };

  const resetRetryAttempts = () => {
    setRetryAttempts({});
  };

  const handleModeChange = (newMode: "single" | "dual" | "quad") => {
    setMode(newMode);
    const defaultModel = allChatModels?.find((model) => model.default);
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
    setSelectedModels((prev) => ({
      ...prev,
      chat1: modelId,
    }));
  };

  // --------------------------------------------
  // Updated ChatWindow sub-component
  // --------------------------------------------
  interface ChatWindowProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
    title: string;
    Icon: React.ComponentType<any>;
    onCopy: () => void;
    onAddToScratchPad: () => void;
    onClearConversation: () => void;
    isCopied: boolean;
    chatWindowId: string;
    isStreaming: boolean;                     // <-- new
    containerRef: React.RefObject<HTMLDivElement>; // <-- new
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
  }: ChatWindowProps) {
    const selectedPersona = personas?.find((p) => p.id.toString() === selectedPersonas[chatWindowId]);
    
    // Get the icon component dynamically
    const IconComponent = getModelIcon(chatWindowId);

    return (
      <TooltipProvider>
        <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <IconComponent className="w-5 h-5" />
                <span className="font-medium">{getModelName(chatWindowId)}</span>
              </div>
              <div className="flex items-center gap-2">
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
            {/* Copy, add to scratch pad, clear */}
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
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onAddToScratchPad}>
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Scratch Pad</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClearConversation}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear Conversation</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Scrollable chat area */}
          <ScrollArea className="flex-1 p-4 relative" ref={containerRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  role={message.role}
                  content={message.content}
                  avatar={message.role === "assistant" ? selectedPersona?.avatar : null}
                />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Show loader only if THIS window is streaming */}
            {isStreaming && (
              <div className="sticky bottom-4 w-full flex justify-center">
                <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating response...</span>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </TooltipProvider>
    );
  }

  // Load assets
  const loadAssets = useCallback(async () => {
    try {
      const headers = getApiHeaders();
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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-64 h-full border-r border-gray-200">
        <AppSidebar toggleChatbot={handleToggleChatbot} />
      </div>

      {/* MAIN PANEL */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Chat Windows */}
        <div className="flex-1 overflow-auto p-4">
          {mode === "single" ? (
            <div className="grid h-full gap-4" style={{ gridTemplateColumns: "1fr" }}>
              <ChatWindow
                messages={messages}
                messagesEndRef={useRef<HTMLDivElement>(null)}
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
              <ChatWindow
                messages={messages}
                messagesEndRef={useRef<HTMLDivElement>(null)}
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
              />

              <ChatWindow
                messages={messages2}
                messagesEndRef={useRef<HTMLDivElement>(null)}
                title="GPT-4o"
                Icon={Sparkles}
                onCopy={() =>
                  copyToClipboard(messages2.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onAddToScratchPad={() =>
                  addToScratchPad(messages2.map((m) => `${m.role}: ${m.content}`).join("\n"))
                }
                onClearConversation={() => clearConversation(messages2)}
                isCopied={copiedStates[messages2.map((m) => `${m.role}: ${m.content}`).join("\n")]}
                chatWindowId="chat2"
                isStreaming={isStreaming2}
                containerRef={chatContainerRef2}
              />

              {mode === "quad" && (
                <>
                  <ChatWindow
                    messages={messages3}
                    messagesEndRef={useRef<HTMLDivElement>(null)}
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
                  />

                  <ChatWindow
                    messages={messages4}
                    messagesEndRef={useRef<HTMLDivElement>(null)}
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
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer (input, modes, etc.) */}
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowUploadModal(true)}>
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
                  onSelectKnowledgeBase={(kb) => setSelectedKnowledgeBases([...selectedKnowledgeBases, kb])}
                  onDeselectKnowledgeBase={(kb) =>
                    setSelectedKnowledgeBases(selectedKnowledgeBases.filter((k) => k.id !== kb.id))
                  }
                  onSelectAsset={(asset) => setSelectedAssets([...selectedAssets, asset])}
                  onDeselectAsset={(asset) =>
                    setSelectedAssets(selectedAssets.filter((a) => a.id !== asset.id))
                  }
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

          <Button onClick={(e) => handleSubmit(e)} disabled={isLoading || (!input.trim() && !uploadedFiles.length)}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>

          {/* Mode toggles */}
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

        {/* File upload pills */}
        {uploadedFiles.length > 0 && (
          <div className="absolute bottom-[72px] left-0 right-0 p-2 bg-background border-t">
            <FileUploadPills files={uploadedFiles} onRemove={handleRemoveFile} />
          </div>
        )}
      </div>

      {/* Complex prompt modal */}
      {selectedComplexPrompt && (
        <ComplexPromptModal
          prompt={selectedComplexPrompt}
          isOpen={!!selectedComplexPrompt}
          onClose={() => setSelectedComplexPrompt(null)}
          onSubmit={handleComplexPromptSubmit}
        />
      )}

      {/* File upload modal */}
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