import { useEffect, useRef, useState } from "react";

interface WaveformVisualizerProps {
  isRecording: boolean;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isRecording,
}) => {
  const [bars, setBars] = useState<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording) {
      // Initialize with random heights
      setBars(Array.from({ length: 40 }, () => Math.random() * 100));

      // Animation loop for waveform
      const animate = () => {
        setBars((prevBars) =>
          prevBars.map((height) => {
            // Simulate audio levels with random adjustments
            const newHeight = height + (Math.random() * 20 - 10);
            return Math.max(5, Math.min(100, newHeight)); // Keep within bounds
          })
        );
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Reset animation when not recording
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Reset to small bars when not recording
      setBars(Array.from({ length: 40 }, () => 5));
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording]);

  return (
    <div className="h-24 flex items-center justify-center">
      <div className="flex items-center h-full w-full gap-1">
        {bars.map((height, i) => (
          <div
            key={i}
            className={`w-1 rounded-full ${
              isRecording ? "bg-indigo-500" : "bg-gray-300"
            }`}
            style={{
              height: `${height}%`,
              transition: isRecording ? "none" : "height 0.5s ease-out",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default WaveformVisualizer;
