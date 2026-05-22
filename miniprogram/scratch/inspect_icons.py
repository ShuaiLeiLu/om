import os
from PIL import Image

dir_path = "/Users/lushuailei/PycharmProjects/Chatty/miniprogram/assets/tabbar"
for name in os.listdir(dir_path):
    if name.endswith(".png"):
        img_path = os.path.join(dir_path, name)
        img = Image.open(img_path)
        print(f"File: {name}, Mode: {img.mode}, Size: {img.size}")
        # Get pixel data
        pixels = list(img.getdata())
        # Inspect some pixels
        non_zero = [p for p in pixels if (p[3] > 0 if len(p) > 3 else True)]
        print(f"  Total non-transparent pixels: {len(non_zero)}")
        if non_zero:
            print(f"  First 5 non-transparent pixels: {non_zero[:5]}")
