import React, { useState, useEffect } from "react";
import mammoth from 'mammoth';

const DocumentViewer = ({ file }) => {
    const [fileContent, setFileContent] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => {
        if (file) {
            const fileType = getFileType(file.name);
            const reader = new FileReader();

            if (fileType === 'pdf') {
                const url = URL.createObjectURL(file);
                setPdfUrl(url);
                setFileContent(null);
                return () => URL.revokeObjectURL(url);
            } else if (fileType === 'txt') {
                reader.onload = (e) => {
                    setFileContent(e.target.result);
                    setPdfUrl(null);
                };
                reader.readAsText(file);
            } else if (fileType === 'doc' || fileType === 'docx') {
                reader.onload = async (e) => {
                    try {
                        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
                        setFileContent(result.value);
                        setPdfUrl(null);
                    } catch (error) {
                        setFileContent("Error reading document");
                        setPdfUrl(null);
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                setFileContent(null);
                setPdfUrl(null);
            }
        }
    }, [file]);

    const getFileIcon = (fileType) => {
        switch(fileType) {
            case 'doc':
            case 'docx':
                return '📄';
            case 'pdf':
                return '📑';
            case 'txt':
                return '📝';
            default:
                return '📎';
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const getFileType = (filename) => {
        return filename.split('.').pop().toLowerCase();
    };

    if (!file) return null;

    const fileType = getFileType(file.name);
    const icon = getFileIcon(fileType);
    const size = formatFileSize(file.size);
    const lastModified = new Date(file.lastModified).toLocaleString();

    return (
        <div className="flex flex-col h-full overflow-hidden rounded-lg border border-gray-200">
            <div className="bg-gray-100 px-4 py-1 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <span className="text-xl">{icon}</span>
                        <h3 className="text-sm font-medium truncate max-w-xs">{file.name}</h3>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>.{fileType.toUpperCase()}</span>
                        <span>{size}</span>
                        <span>{lastModified}</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col flex-1 p-2 bg-white overflow-hidden">
                {pdfUrl && (
                    <div className="flex-1 min-h-0">
                        <iframe 
                            src={pdfUrl}
                            className="w-full h-full border-0"
                            title="PDF viewer"
                        />
                    </div>
                )}
                {(fileType === 'txt' || fileType === 'doc' || fileType === 'docx') && fileContent && (
                    <div className="flex-1 p-2 bg-gray-50 rounded border border-gray-200 overflow-auto">
                        <p className="text-sm font-mono whitespace-pre-wrap">{fileContent}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AnalysisPanel = () => {
    const [uploadedFile, setUploadedFile] = useState(null);
    const [fileSummary, setFileSummary] = useState("");
    const [loading, setLoading] = useState(false); // Track loading state

    useEffect(() => {
        const handleFileUpload = (event) => {
            setUploadedFile(event.detail);
            setFileSummary("");  // Clear previous summary
            setLoading(true);  // Start loading
        };

        const handleFileSummary = (event) => {
            setFileSummary(event.detail);
            setLoading(false); // Stop loading
        };

        window.addEventListener('fileUploaded', handleFileUpload);
        window.addEventListener('fileSummary', handleFileSummary);

        return () => {
            window.removeEventListener('fileUploaded', handleFileUpload);
            window.removeEventListener('fileSummary', handleFileSummary);
        };
    }, []);

    return (
        <div className="p-6 bg-white h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">File Analysis</h2>
            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
                {/* Left Side: Document Viewer */}
                <div className="flex flex-col min-h-0 flex-1">
                    <DocumentViewer file={uploadedFile} />
                </div>

                {/* Right Side: Summary Panel */}
                <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-auto">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Summary</h3>
                    
                    {loading ? (
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin h-6 w-6 text-gray-600" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                            <span className="ml-2 text-sm text-gray-600">Generating summary...</span>
                        </div>
                    ) : fileSummary ? (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{fileSummary}</p>
                    ) : (
                        <p className="text-gray-400 italic">No summary available. Upload a file to generate one.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalysisPanel;
