import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useSnapToAdd } from '../../hooks/useSnapToAdd'

export default function SnapToAddZone() {
    const { snapToAdd, loading, error } = useSnapToAdd()

    const onDrop = useCallback(async (acceptedFiles) => {
        if (acceptedFiles?.length > 0) {
            try {
                // Process the first file dropped
                await snapToAdd(acceptedFiles[0])
            } catch (err) {
                // Error is handled by the hook (toast)
                console.error("SnapToAdd failed:", err)
            }
        }
    }, [snapToAdd])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt']
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024, // 10MB
        disabled: loading
    })

    return (
        <div className="w-full mb-6">
            <div
                {...getRootProps()}
                className={`
                    w-full relative overflow-hidden flex flex-col items-center justify-center p-6 text-center 
                    border-2 border-dashed rounded-[var(--radius-lg)] transition-all duration-300 ease-in-out
                    ${loading ? 'bg-bg-secondary border-border cursor-wait' : 
                      isDragActive ? 'bg-accent/5 border-accent scale-[1.01]' : 
                      'bg-bg-secondary/30 border-border/50 hover:bg-bg-secondary/50 hover:border-border cursor-pointer'
                    }
                `}
            >
                <input {...getInputProps()} />

                {loading ? (
                    <div className="flex flex-col items-center justify-center space-y-3 animate-pulse">
                        <div className="w-10 h-10 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                        <p className="text-sm font-medium text-text-primary">
                            Extracting details with AI...
                        </p>
                        <p className="text-xs text-text-muted">
                            This usually takes a few seconds.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-transform duration-300
                            ${isDragActive ? 'scale-110 bg-accent text-white' : 'bg-bg-card border border-border text-accent'}
                        `}>
                            {isDragActive ? '✨' : '🪄'}
                        </div>
                        <h3 className="font-semibold text-text-primary mt-2">
                            {isDragActive ? 'Drop file here!' : 'Auto-magic your trip'}
                        </h3>
                        <p className="text-sm text-text-muted max-w-md mx-auto">
                            Drop booking PDFs, hotel screenshots, or tickets here.
                        </p>
                    </div>
                )}
            </div>
            
            {error && (
                <p className="text-xs text-danger mt-2 text-center animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    )
}
