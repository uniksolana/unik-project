
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
    # Process all three token icons from user uploads
    # EURC - image 0
    eurc_input = "/home/unik/.gemini/antigravity/brain/ac99dcad-cfc9-4b99-aba5-20fa05f6d816/uploaded_media_0_1769440247976.png"
    remove_background(eurc_input, "public/eurc.png", fuzzing=30)
    
    # SOL - image 1
    sol_input = "/home/unik/.gemini/antigravity/brain/ac99dcad-cfc9-4b99-aba5-20fa05f6d816/uploaded_media_1_1769440247976.png"
    remove_background(sol_input, "public/sol.png", fuzzing=30)
    
    # USDC - image 2
    usdc_input = "/home/unik/.gemini/antigravity/brain/ac99dcad-cfc9-4b99-aba5-20fa05f6d816/uploaded_media_2_1769440247976.png"
    remove_background(usdc_input, "public/usdc.png", fuzzing=30)
