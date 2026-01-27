#!/usr/bin/env python3
"""
Script to remove the square border from a GIF image.
Removes dark blue/purple border pixels and replaces them with transparency or background color.
"""

from PIL import Image
import sys
import os

def remove_border_from_gif(input_path, output_path):
    """
    Remove dark blue/purple border from GIF frames.
    
    Args:
        input_path: Path to input GIF file
        output_path: Path to save processed GIF file
    """
    # Open the GIF
    gif = Image.open(input_path)
    
    # Get GIF properties
    frames = []
    durations = []
    
    # Process each frame
    try:
        while True:
            # Convert to RGBA if not already
            frame = gif.convert('RGBA')
            pixels = frame.load()
            width, height = frame.size
            
            # Define border colors to remove (dark blue/purple shades)
            # These are RGB values that represent the border
            border_colors = [
                (0, 0, 50, 255),    # Very dark blue
                (20, 20, 60, 255),  # Dark blue
                (30, 30, 80, 255),  # Medium dark blue
                (40, 20, 90, 255),  # Dark purple-blue
                (50, 30, 100, 255), # Purple-blue
            ]
            
            # Tolerance for color matching
            tolerance = 30
            
            # Process each pixel
            for y in range(height):
                for x in range(width):
                    r, g, b, a = pixels[x, y]
                    
                    # Check if pixel matches border color
                    is_border = False
                    for border_r, border_g, border_b, _ in border_colors:
                        if (abs(r - border_r) < tolerance and 
                            abs(g - border_g) < tolerance and 
                            abs(b - border_b) < tolerance):
                            is_border = True
                            break
                    
                    # Also check for very dark colors that might be border
                    # (dark blue/purple typically has low brightness)
                    if not is_border:
                        brightness = (r + g + b) / 3
                        # If it's very dark and has more blue than red/green, it's likely border
                        if brightness < 60 and b > r and b > g:
                            is_border = True
                    
                    # Replace border pixels with transparent
                    if is_border:
                        pixels[x, y] = (0, 0, 0, 0)  # Transparent
                    # Or if you prefer black background:
                    # pixels[x, y] = (0, 0, 0, 255)  # Black
            
            frames.append(frame.copy())
            
            # Get frame duration
            duration = gif.info.get('duration', 100)
            durations.append(duration)
            
            # Move to next frame
            try:
                gif.seek(gif.tell() + 1)
            except EOFError:
                break
                
    except Exception as e:
        print(f"Error processing frames: {e}")
        return False
    
    # Save the processed GIF
    if frames:
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=gif.info.get('loop', 0),
            transparency=0,
            disposal=2  # Clear to background
        )
        print(f"Successfully processed {len(frames)} frames")
        print(f"Output saved to: {output_path}")
        return True
    else:
        print("No frames to process")
        return False

if __name__ == "__main__":
    # Default paths
    input_file = "assets/dd-idl1.gif"
    output_file = "assets/dd-idl1.gif"  # Overwrite original
    
    # Allow command line arguments
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    # Get absolute paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    input_path = os.path.join(project_root, input_file)
    output_path = os.path.join(project_root, output_file)
    
    # Check if input file exists
    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    print(f"Processing: {input_path}")
    print(f"Output: {output_path}")
    
    # Process the GIF
    success = remove_border_from_gif(input_path, output_path)
    
    if success:
        print("Border removal completed successfully!")
    else:
        print("Border removal failed!")
        sys.exit(1)
