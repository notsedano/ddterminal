"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/utils/cn";

interface HackerBackgroundProps {
  color?: string;
  fontSize?: number;
  speed?: number;
  className?: string;
}

export function HackerBackground({
  color = "#3B82F6",
  fontSize = 14,
  speed = 1,
  className,
}: HackerBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Characters to use for the matrix effect
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    const charArray = chars.split("");

    // Column positions and speeds
    let columns: Array<{
      x: number;
      y: number;
      speed: number;
      chars: string[];
    }> = [];

    const initColumns = () => {
      columns = [];
      const columnCount = Math.floor(canvas.width / fontSize);
      for (let i = 0; i < columnCount; i++) {
        columns.push({
          x: i * fontSize,
          y: Math.random() * canvas.height,
          speed: 0.5 + Math.random() * speed,
          chars: Array.from({ length: Math.floor(canvas.height / fontSize) + 1 }, () =>
            charArray[Math.floor(Math.random() * charArray.length)]
          ),
        });
      }
    };

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initColumns();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Animation loop
    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = color;
      ctx.font = `${fontSize}px monospace`;

      columns.forEach((column) => {
        // Draw characters
        column.chars.forEach((char, index) => {
          const y = column.y + index * fontSize;
          if (y > 0 && y < canvas.height) {
            const opacity = index === 0 ? 1 : Math.max(0, 1 - index * 0.1);
            ctx.globalAlpha = opacity;
            ctx.fillText(char, column.x, y);
          }
        });

        // Update position
        column.y += column.speed;

        // Reset column if it goes off screen
        if (column.y > canvas.height) {
          column.y = -fontSize;
          // Shuffle characters
          column.chars = Array.from({ length: Math.floor(canvas.height / fontSize) + 1 }, () =>
            charArray[Math.floor(Math.random() * charArray.length)]
          );
        }
      });

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [color, fontSize, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 w-full h-full", className)}
      style={{ pointerEvents: "none" }}
    />
  );
}
