
from PIL import Image
import sys
import os

def remove_background(input_path, output_path, fuzzing=10):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        datas = img.getdata()
        
        newData = []
        # Get corner color to assume as background
        bg_color = img.getpixel((0, 0))
        
        # Simple heuristic: Transparent if close to background color
        # For Sol (Black BG): (0, 0, 0)
        # For others it might be white or dark grey
        
        for item in datas:
            # Check Euclidean distance or simple tolerance
            if abs(item[0] - bg_color[0]) < fuzzing and abs(item[1] - bg_color[1]) < fuzzing and abs(item[2] - bg_color[2]) < fuzzing:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
                
        img.putdata(newData)
        
        # Crop to content (optional but good)
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        img.save(output_path, "PNG")
        print(f"Processed {input_path} -> {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

if __name__ == "__main__":
    remove_background("public/sol_raw.png", "public/sol.png", fuzzing=30)
    remove_background("public/usdc_raw.png", "public/usdc.png", fuzzing=30)
    remove_background("public/eurc_raw.png", "public/eurc.png", fuzzing=30)
