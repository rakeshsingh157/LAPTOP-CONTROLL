#!/usr/bin/env python3
import sys
import json
import time
import requests
from rich.console import Console
from rich.panel import Panel
from rich import print as rprint
from rich.prompt import Prompt
import os

API_BASE = "http://localhost:62007/api"
console = Console()

def send_action(action):
    try:
        res = requests.post(f"{API_BASE}/system/send_phone_cmd", json={"action": action}, timeout=3)
        if res.status_code == 200:
            return True
        else:
            rprint(f"[red]Error:[/red] Phone disconnected or API unreachable. Status: {res.status_code}")
            return False
    except Exception as e:
        rprint(f"[red]Error connecting to engine:[/red] {e}")
        return False

def wait_for_response(timeout=10):
    # Wait for the backend to drop the phone_cmd_response.json payload
    start = time.time()
    response_file = "/tmp/phone_cmd_response.json"
    if os.path.exists(response_file):
        os.remove(response_file)
        
    with console.status("[cyan]Waiting for phone reply..."):
        while time.time() - start < timeout:
            if os.path.exists(response_file):
                try:
                    with open(response_file, "r") as f:
                        data = json.load(f)
                    os.remove(response_file)
                    return data
                except:
                    pass
            time.sleep(0.5)
    return None

def find_phone():
    rprint("[bold green]Sending APOCALYPTIC RING command to phone...[/bold green]")
    if send_action("ring"):
        rprint("[yellow]Bypassing Do Not Disturb...[/yellow]")
        rprint("[yellow]Maximizing volume streams...[/yellow]")
        rprint("[bold green]Phone is now screaming.[/bold green]")
        
        # Optionally ask for location
        rprint("\n[blue]Attempting to triangulate location...[/blue]")
        if send_action("location"):
            resp = wait_for_response()
            if resp and "url" in resp:
                rprint(f"\n[bold magenta]📍 GPS LOCK:[/bold magenta] {resp['url']}")
            else:
                rprint("[red]Could not get GPS lock.[/red]")

def get_location():
    rprint("[bold blue]Silent GPS Triangulation Initiated...[/bold blue]")
    if send_action("location"):
        resp = wait_for_response()
        if resp and "url" in resp:
            rprint(f"\n[bold magenta]📍 GPS LOCK:[/bold magenta] {resp['url']}")
        else:
            rprint("[red]Could not get GPS lock.[/red]")

def stop_phone():
    if send_action("stop_ring"):
        rprint("[green]Sent kill-signal to phone alarm.[/green]")

def stop_laptop():
    try:
        requests.post(f"{API_BASE}/system/laptop/stop_ring")
        rprint("[green]Laptop alarm stopped.[/green]")
    except Exception as e:
        rprint(f"[red]Failed:[/red] {e}")

def dashboard():
    console.clear()
    rprint(Panel.fit("[bold blue]📱 STITCH PHONE TERMINAL[/bold blue]", border_style="cyan"))
    
    while True:
        rprint("\n[bold]Commands:[/bold]")
        rprint("  [cyan]find[/cyan]     - Ring phone continuously at MAX volume and retrieve GPS")
        rprint("  [cyan]loc[/cyan]      - Silently fetch GPS location map link")
        rprint("  [cyan]stop[/cyan]     - Stop phone ringing")
        rprint("  [cyan]stop-pc[/cyan]  - Stop laptop ringing")
        rprint("  [cyan]exit[/cyan]     - Close terminal")
        
        cmd = Prompt.ask("\n[bold yellow]>[/bold yellow]").strip().lower()
        if cmd == "find":
            find_phone()
        elif cmd == "loc" or cmd == "location":
            get_location()
        elif cmd == "stop":
            stop_phone()
        elif cmd == "stop-pc" or cmd == "stop-laptop":
            stop_laptop()
        elif cmd in ["exit", "quit", "q"]:
            break
        else:
            rprint("[red]Unknown command.[/red]")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        if cmd == "find": find_phone()
        elif cmd == "location" or cmd == "loc": get_location()
        elif cmd == "stop": stop_phone()
        elif cmd == "stop-laptop": stop_laptop()
        else: rprint(f"Unknown command: {cmd}")
    else:
        dashboard()
