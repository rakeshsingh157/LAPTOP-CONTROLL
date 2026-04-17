import pystray
from PIL import Image, ImageDraw
import webbrowser
import threading

def create_image():
    # Generate a simple 64x64 blue icon with a white circle (represents Stitch)
    image = Image.new('RGB', (64, 64), (0, 0, 0))
    dc = ImageDraw.Draw(image)
    dc.rectangle(
        (0, 0, 64, 64),
        fill="#3b82f6"
    )
    dc.ellipse((16, 16, 48, 48), fill="white")
    return image

def on_clicked(icon, item):
    if str(item) == "Open Dashboard":
        webbrowser.open("http://localhost:62007/")
    elif str(item) == "Quit":
        icon.stop()

def spawn_tray():
    image = create_image()
    menu = pystray.Menu(
        pystray.MenuItem("Open Dashboard", on_clicked, default=True),
        pystray.MenuItem("Quit", on_clicked)
    )
    icon = pystray.Icon("Stitch", image, "Stitch Phone Link", menu)
    icon.run()

if __name__ == "__main__":
    spawn_tray()
