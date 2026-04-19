import os
import threading
import sys
import tempfile
import socket
import logging
import stat as stat_module
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.filesystems import AbstractedFS

from routes.system import sync_phone_fs_request, PHONE_WS_CONNECTION

# Configure internal logging for the FTP server
logging.basicConfig(filename='/tmp/phone_ftp_debug.log', level=logging.DEBUG, 
                   format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("phone_ftp")

class StatObj:
    def __init__(self, size, is_dir, mtime):
        self.st_size = int(size)
        self.st_mtime = float(mtime) if mtime else 0.0
        self.st_mode = (stat_module.S_IFDIR | 0o777) if is_dir else (stat_module.S_IFREG | 0o666)
        self.st_nlink = 1
        self.st_uid = 0
        self.st_gid = 0
        self.st_atime = self.st_mtime
        self.st_ctime = self.st_mtime

class PhoneTCPFile:
    def __init__(self, mode, file_path):
        self.mode = mode
        self.file_path = file_path
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(10.0) # 10s timeout for connection
        self.sock.bind(("0.0.0.0", 0))
        self.port = self.sock.getsockname()[1]
        self.sock.listen(1)
        
        self.client_sock = None
        self._file_obj = None
        
        try:
            if 'r' in mode:
                sync_phone_fs_request("fs_send_tcp", path=file_path, port=self.port)
                self.client_sock, _ = self.sock.accept()
                self._file_obj = self.client_sock.makefile('rb')
            elif 'w' in mode:
                sync_phone_fs_request("fs_recv_tcp", path=file_path, port=self.port)
                self.client_sock, _ = self.sock.accept()
                self._file_obj = self.client_sock.makefile('wb')
        except Exception as e:
            logger.error(f"TCP Transfer setup failed: {e}")
            self.close()
            raise OSError(f"Failed to establish phone TCP connection: {e}")

    def read(self, size):
        return self._file_obj.read(size) if self._file_obj else b""

    def write(self, data):
        if self._file_obj:
            self._file_obj.write(data)

    def close(self):
        try:
            if self._file_obj:
                self._file_obj.close()
            if self.client_sock:
                self.client_sock.close()
            self.sock.close()
        except:
            pass

class PhoneFS(AbstractedFS):
    def __init__(self, root, cmd_channel):
        super().__init__(root, cmd_channel)
        self._stat_cache = {}

    def _map(self, path):
        # We assume 'root' is '/tmp/phone_ftp_root'
        root = self.root.rstrip('/')
        if path == root or path == root + "/":
            return "/sdcard"
        if path.startswith(root + "/"):
            return "/sdcard/" + path[len(root)+1:]
        # Fallback if path is already mapped (pyftpdlib quirk)
        if path.startswith("/sdcard"):
            return path
        return "/sdcard"

    def stat(self, path):
        if path in self._stat_cache:
            return self._stat_cache[path]
            
        mapped = self._map(path)
        try:
            res = sync_phone_fs_request("fs_stat", path=mapped)
            if not res or not res.get("success"):
                raise FileNotFoundError()
            
            d = res.get("data", {})
            st = StatObj(d.get("size", 0), d.get("is_dir", False), d.get("mtime", 0))
            self._stat_cache[path] = st
            return st
        except Exception as e:
            logger.debug(f"Stat failed for {path} ({mapped}): {e}")
            raise FileNotFoundError()

    def listdir(self, path):
        mapped = self._map(path)
        try:
            res = sync_phone_fs_request("fs_list", path=mapped)
            if not res or not res.get("success"):
                raise FileNotFoundError()
                
            names = []
            for f in res.get("data", []):
                name = f["name"]
                names.append(name)
                # Populate cache for subsequent STAT calls
                c_path = os.path.join(path, name)
                self._stat_cache[c_path] = StatObj(f.get("size", 0), f.get("is_dir", False), f.get("mtime", 0))
            return names
        except Exception as e:
            logger.error(f"Listdir failed for {path} ({mapped}): {e}")
            raise FileNotFoundError()

    def isdir(self, path):
        try:
            return stat_module.S_ISDIR(self.stat(path).st_mode)
        except:
            return False

    def isfile(self, path):
        try:
            return stat_module.S_ISREG(self.stat(path).st_mode)
        except:
            return False
            
    def islink(self, path):
        return False
        
    def getsize(self, path):
        return self.stat(path).st_size

    def getmtime(self, path):
        return self.stat(path).st_mtime
        
    def lexists(self, path):
        try:
            self.stat(path)
            return True
        except:
            return False

    def get_user_by_uid(self, uid):
        return "root"

    def get_group_by_gid(self, gid):
        return "root"
        
    def realpath(self, path):
        return path

    def remove(self, path):
        res = sync_phone_fs_request("fs_delete", path=self._map(path))
        if not res or not res.get("success"):
            raise OSError("Delete failed")

    def rmdir(self, path):
        self.remove(path)

    def mkdir(self, path):
        res = sync_phone_fs_request("fs_mkdir", path=self._map(path))
        if not res or not res.get("success"):
            raise OSError("Mkdir failed")
            
    def rename(self, src, dst):
        res = sync_phone_fs_request("fs_rename", src=self._map(src), dst=self._map(dst))
        if not res or not res.get("success"):
            raise OSError("Rename failed")

    def chmod(self, path, mode):
        pass

    def open(self, filename, mode):
        return PhoneTCPFile(mode, self._map(filename))

class PhoneHandler(FTPHandler):
    # Use custom formatting to bypass OS-dependent path checks in pyftpdlib
    def format_list(self, basedir, listing, ignore_err=True):
        for name in listing:
            path = os.path.join(basedir, name)
            try:
                st = self.abstracted_fs.stat(path)
            except Exception:
                if ignore_err: continue
                raise
            perms = "drwxrwxrwx" if stat_module.S_ISDIR(st.st_mode) else "-rw-rw-rw-"
            yield f"{perms} 1 root root {st.st_size:>8} Jan 01 00:00 {name}\r\n"

    def format_mlsx(self, basedir, listing, perms, facts, ignore_err=True):
        for name in listing:
            path = os.path.join(basedir, name)
            try:
                st = self.abstracted_fs.stat(path)
            except Exception:
                if ignore_err: continue
                raise
            ptype = "dir" if stat_module.S_ISDIR(st.st_mode) else "file"
            yield f"Type={ptype};Size={st.st_size};Modify=20240101000000; {name}\r\n"

def wait_and_run_ftp():
    homedir = "/tmp/phone_ftp_root"
    os.makedirs(homedir, exist_ok=True)
    authorizer = DummyAuthorizer()
    authorizer.add_anonymous(homedir, perm="elradfmwMT")
    
    handler = PhoneHandler
    handler.authorizer = authorizer
    handler.abstracted_fs = PhoneFS
    handler.passive_ports = range(60000, 60100) # Optional: help with firewall
    
    logger.info("Starting FTP server on port 2121")
    server = FTPServer(("127.0.0.1", 2121), handler)
    server.serve_forever()

def start_phone_ftp_server():
    threading.Thread(target=wait_and_run_ftp, daemon=True).start()
