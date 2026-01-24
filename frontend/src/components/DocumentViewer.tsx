import React, { useEffect, useState } from "react";
import { MdClose, MdDownload, MdOpenInNew } from "react-icons/md";

interface DocumentViewerProps {
  documentUrl: string;
  documentName: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentUrl,
  documentName,
  isOpen,
  onClose,
  onDownload,
}) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
    }
  }, [isOpen, documentUrl]);

  if (!isOpen) return null;

  const isPDF = documentName.toLowerCase().endsWith(".pdf");
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(documentName);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md w-[95vw] h-[95vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-md">
              {documentName}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
                title="Download"
              >
                <MdDownload className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => window.open(documentUrl, "_blank")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
              title="Open in new tab"
            >
              <MdOpenInNew className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
              title="Close"
            >
              <MdClose className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-hidden relative bg-gray-100 dark:bg-gray-900">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          )}

          {isPDF && (
            <iframe
              src={`${documentUrl}#toolbar=1`}
              className="w-full h-full"
              title={documentName}
              onLoad={() => setLoading(false)}
            />
          )}

          {isImage && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={documentUrl}
                alt={documentName}
                className="max-w-full max-h-full object-contain"
                onLoad={() => setLoading(false)}
              />
            </div>
          )}

          {!isPDF && !isImage && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 dark:text-gray-400">
              <p className="text-lg mb-4">Preview not available for this file type</p>
              <button
                onClick={() => window.open(documentUrl, "_blank")}
                className="btn btn-primary"
              >
                Open in New Tab
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
