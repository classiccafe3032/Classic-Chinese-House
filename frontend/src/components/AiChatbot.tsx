import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { API_URL } from "@/lib/apiClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AiChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm the digital assistant for Classic Chinese. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textOverride?: string) => {
    const messageText = typeof textOverride === 'string' ? textOverride : input;
    if (!messageText.trim()) return;

    const userMsg: Message = { role: "user", content: messageText.trim() };
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: newMessages.slice(-10) }), // Send last 10 messages for context
      });

      const data = await response.json();
      
      if (response.ok && data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now." }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered a network error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLoadMore = async (phone: string, page: number, msgIndex: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/ai/orders/${phone}?page=${page}`);
      const data = await response.json();
      
      if (response.ok && data.text) {
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[msgIndex].content = newMsgs[msgIndex].content.replace(/\[LOAD_MORE_ORDERS:\s*\d{10}\s*:\s*\d+\]/, "");
          return [...newMsgs, { role: "assistant", content: data.text }];
        });
      }
    } catch (error) {
      console.error("Load more error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isOpen ? 0 : 1, y: isOpen ? 20 : 0 }}
        style={{ pointerEvents: isOpen ? 'none' : 'auto' }}
      >
        <MessageCircle size={28} />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-[90vw] sm:w-[380px] h-[550px] max-h-[85vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Classic Chinese AI</h3>
                  <p className="text-xs text-primary-foreground/80">Online and ready to help</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary-foreground/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2 max-w-full`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary mt-1">
                      <Bot size={16} />
                    </div>
                  )}
                  
                  <div 
                    className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm ${
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-sm" 
                        : "bg-background border border-border text-foreground rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content.replace("[ORDER_BTN]", "").replace(/\[LOAD_MORE_ORDERS:.*?\]/g, "").replace(/\[LOAD_MORE_MENU:.*?\]/g, "")}</p>
                    ) : (
                      <div className="leading-relaxed">
                        <ReactMarkdown 
                          components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                          em: ({node, ...props}) => <em className="italic" {...props} />
                        }}
                      >
                        {msg.content.replace("[ORDER_BTN]", "").replace(/\[LOAD_MORE_ORDERS:.*?\]/g, "").replace(/\[LOAD_MORE_MENU:.*?\]/g, "")}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.role === "assistant" && msg.content.includes("[ORDER_BTN]") && (
                      <Link 
                        to="/order"
                        className="mt-3 inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl text-sm font-bold transition-colors w-full justify-center"
                        onClick={() => setIsOpen(false)}
                      >
                        <ShoppingCart size={16} />
                        Order Now
                      </Link>
                    )}
                    {msg.role === "assistant" && msg.content.includes("[LOAD_MORE_ORDERS:") && (() => {
                      const match = msg.content.match(/\[LOAD_MORE_ORDERS:\s*(\d{10})\s*:\s*(\d+)\]/);
                      if (match) {
                        const phone = match[1];
                        const page = parseInt(match[2]);
                        return (
                          <button 
                            onClick={() => handleLoadMore(phone, page, idx)}
                            className="mt-3 inline-flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-xl text-sm font-bold transition-colors w-full justify-center border border-border"
                          >
                            Load Older Orders
                          </button>
                        );
                      }
                      return null;
                    })()}
                    {msg.role === "assistant" && msg.content.includes("[LOAD_MORE_MENU:") && (() => {
                      const match = msg.content.match(/\[LOAD_MORE_MENU:\s*([^\]]+)\]/);
                      if (match) {
                        const category = match[1].trim();
                        return (
                          <button 
                            onClick={() => handleSend(`Show me more items from ${category}`)}
                            className="mt-3 inline-flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-xl text-sm font-bold transition-colors w-full justify-center border border-border"
                          >
                            Load More {category}
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary mt-1">
                    <Bot size={16} />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-background border border-border rounded-tl-sm shadow-sm flex items-center gap-2 text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-background border-t border-border flex flex-col gap-2">
              
              {/* Suggestion Chips */}
              {messages.length === 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {[
                    "What are your specials?",
                    "Show my order history",
                    "Do you have vegan options?",
                    "What are your opening hours?"
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(chip)}
                      className="whitespace-nowrap px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/20 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 bg-muted rounded-xl p-1 border border-border/50 focus-within:border-primary/50 transition-colors">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about our menu..."
                  className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-32 min-h-[44px] py-3 px-3 text-base md:text-sm"
                  rows={1}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 mb-0.5 mr-0.5 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors flex-shrink-0"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AiChatbot;
