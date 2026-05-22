import os
from PIL import Image

dir_path = "/Users/lushuailei/PycharmProjects/Chatty/miniprogram/assets/tabbar"

# Inactive color: #9ca3af -> RGB (156, 163, 175)
inactive_rgb = (156, 163, 175)

# Active color: #a855f7 -> RGB (168, 85, 247)
active_rgb = (168, 85, 247)

for name in os.listdir(dir_path):
    if name.endswith(".png"):
        img_path = os.path.join(dir_path, name)
        img = Image.open(img_path).convert("RGBA")
        
        # Determine target color based on filename
        if "active" in name:
            target_rgb = active_rgb
        else:
            target_rgb = inactive_rgb
            
        # Process pixels
        pixels = img.load()
        width, height = img.size
        for x in range(width):
            for y in range(height):
                r, g, b, a = pixels[x, y]
                # If the pixel is not fully transparent, colorize it
                if a > 0:
                    pixels[x, y] = (target_rgb[0], target_rgb[1], target_rgb[2], a)
                    
        # Save back
        img.save(img_path)
        print(f"Colorized {name} to {target_rgb}")
