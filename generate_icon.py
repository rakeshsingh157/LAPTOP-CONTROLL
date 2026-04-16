from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(path, size, text):
    img = Image.new('RGB', (size, size), color=(20, 20, 24))
    draw = ImageDraw.Draw(img)
    
    # Draw simple laptop silhouette
    cx, cy = size/2, size/2
    draw.rectangle([cx-size*0.3, cy-size*0.2, cx+size*0.3, cy+size*0.1], outline=(0, 150, 255), width=int(size*0.02))
    draw.rectangle([cx-size*0.4, cy+size*0.1, cx+size*0.4, cy+size*0.15], fill=(0, 150, 255))
    
    # Try to load a font, or fallback to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size=int(size*0.2))
    except:
        font = ImageFont.load_default()
    
    # Draw text
    draw.text((cx, cy-size*0.05), text, fill=(255, 255, 255), font=font, anchor="mm")
    
    img.save(path)

assets_dir = "../frontend/assets"
os.makedirs(assets_dir, exist_ok=True)
create_icon(f"{assets_dir}/icon.png", 1024, "RL")
create_icon(f"{assets_dir}/adaptive-icon.png", 1024, "RL")
create_icon(f"{assets_dir}/splash-icon.png", 1024, "RL")

print("Icons created successfully")
