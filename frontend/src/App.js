import React from "react";
import ChatInterface from "./components/ChatInterface";
import AnalysisPanel from "./components/AnalysisPanel";

const App = () => {
    return (
        <div className="h-screen flex">
           
            {/* Chat Panel (30% width) */}
            <div className="w-110 h-full bg-gray-100 border-r shadow-md">
                <ChatInterface />
            </div>
            {/* Analysis Panel (70% width) */}
            <div className="w-3/4 h-full bg-gray-50">
                <AnalysisPanel />
            </div>
        </div>
    );
};

export default App;
