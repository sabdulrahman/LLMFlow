import React, { useState, useRef, useEffect } from "react";

const ChatInterface = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [selectedLLM, setSelectedLLM] = useState("ollama");
    const [selectedFile, setSelectedFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            window.dispatchEvent(new CustomEvent('fileUploaded', { detail: file }));
    
            const formData = new FormData();
            formData.append("file", file);
    
            try {
                const response = await fetch("http://localhost:8000/upload-file", {
                    method: "POST",
                    body: formData,
                });
    
                const data = await response.json();
                console.log("Summary:", data.summary);
    
                window.dispatchEvent(new CustomEvent('fileSummary', { detail: data.summary }));
            } catch (error) {
                console.error("File upload failed:", error);
                window.dispatchEvent(new CustomEvent('fileSummary', { detail: "Error generating summary." }));
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { type: "user", content: input };
        setInput("");
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await fetch("http://localhost:8000/process-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: input, llm: selectedLLM }),
            });
            const data = await response.json();
            const systemMessage = { type: "system", content: data.response };
            setMessages((prev) => [...prev, systemMessage]);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className="flex flex-col h-full">
            {/* Messages container with fixed height and scrolling */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.type === "user" ? "items-end" : "items-start"}`}>
                        <div className="text-xs text-gray-500 mb-1">{msg.type === "user" ? "User" : "Chatbot"}</div>
                        <div
                            className={`max-w-xs px-4 py-2 rounded-lg shadow-md ${
                                msg.type === "user"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-300 text-black"
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input container with fixed height */}
            <div className="flex-none bg-white p-4 border-t">
                <div className="flex items-center space-x-4">
                    <label className="flex-none px-4 py-2 bg-gray-200 text-gray-700 rounded-full cursor-pointer hover:bg-gray-300 transition">
                        <input
                            type="file"
                            className="hidden"
                            accept=".txt,.doc,.docx,.pdf"
                            onChange={handleFileUpload}
                        />
                        <span>Upload</span>
                    </label>
                    <select
                        value={selectedLLM}
                        onChange={(e) => setSelectedLLM(e.target.value)}
                        className="flex-none border border-gray-300 rounded-full p-2 focus:outline-none"
                    >
                        <option value="ollama">Llama3.2</option>
                        <option value="deepseek">Deepseek</option>
                        <option value="GPT">GPT</option>
                    </select>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        className="flex-1 border border-gray-300 rounded-full p-2 px-4 focus:outline-none focus:ring focus:ring-blue-500"
                        placeholder="Type a message..."
                    />
                    <button
                        onClick={handleSend}
                        className="flex-none bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600 transition"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;