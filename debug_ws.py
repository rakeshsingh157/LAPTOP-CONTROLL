with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'r') as f:
    t = f.read()

t = t.replace('except Exception as e:\n            pass', 'except Exception as e:\n            print("Inner loop err:", e)')
t = t.replace('except Exception as e:\n        print("Screen WS startup error:", e)', 'except Exception as e:\n        print("Outer err:", e)')
t = t.replace('except Exception as e:\n                pass', 'except Exception as e:\n                print("Recv loop err:", e)')

with open('/home/rakesh-singh/Documents/LAPTOP ACCESS/backend/routes/system.py', 'w') as f:
    f.write(t)
