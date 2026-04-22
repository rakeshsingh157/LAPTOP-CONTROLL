import os
import threading
import sys
import tempfile
import socket
import logging
import stat as stat_module
import subprocess
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.filesystems import AbstractedFS

from routes.system import sync_phone_fs_request, sync_phone_fs_send_only, PHONE_WS_CONNECTION

# Configure internal logging for the FTP server
logging.basicConfig(filename='/tmp/phone_ftp_debug.log', level=logging.DEBUG, 
                   format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("phone_ftp")

class StatObj:
    def __init__(self, size, is_dir, mtime):
        self.st_size = int(size)
        self.st_mtime = float(mtime) if mtime else 1704067200.0 # Default to 2024 if 0
        self.st_mode = (stat_module.S_IFDIR | 0o777) if is_dir else (stat_module.S_IFREG | 0o666)
        self.st_nlink = 1
        self.st_uid = 1000
        self.st_gid = 1000
        self.st_atime = self.st_mtime
        self.st_ctime = self.st_mtime

def get_laptop_ip():
    # Try to find tailscale IP first (preferred for stability)
    try:
        res = subprocess.run(['ip', 'addr', 'show', 'tailscale0'], capture_output=True, text=True)
        for line in res.stdout.splitlines():
            if 'inet ' in line:
                return line.split()[1].split('/')[0]
    except:
        pass
    
    # Fallback to Wi-Fi/Interface IP
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Use a dummy connection to determine local IP
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class PhoneTCPFile:
    def __init__(self, mode, file_path):
        self.mode = mode
        self.file_path = file_path
        self.name = file_path
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(10.0) # 10s timeout for connection
        self.sock.bind(("0.0.0.0", 0))
        self.port = self.sock.getsockname()[1]
        self.sock.listen(1)
        
        self.client_sock = None
        self._file_obj = None
        self.closed = False
        
        try:
            host = get_laptop_ip()
            logger.info(f"TCP Transfer: Phone connecting to {host}:{self.port}")
            from concurrent.futures import TimeoutError as FuturesTimeoutError
            
            if 'r' in mode:
                sync_phone_fs_send_only("fs_send_tcp", path=file_path, port=self.port, host=host)
                self.client_sock, _ = self.sock.accept()
                logger.info("TCP Transfer: Connection accepted from phone")
                self._file_obj = self.client_sock.makefile('rb')
            elif 'w' in mode:
                sync_phone_fs_send_only("fs_recv_tcp", path=file_path, port=self.port, host=host)
                self.client_sock, _ = self.sock.accept()
                logger.info("TCP Transfer: Connection accepted from phone")
                self._file_obj = self.client_sock.makefile('wb')
        except Exception as e:
            logger.error(f"TCP Transfer setup failed: {e}")
            self.close()
            import errno
            raise OSError(errno.ETIMEDOUT, f"Failed to establish phone TCP connection: {e}")

    def read(self, size=-1):
        return self._file_obj.read(size) if self._file_obj else b""

    def write(self, data):
        if self._file_obj:
            self._file_obj.write(data)

    def flush(self):
        if self._file_obj:
            self._file_obj.flush()

    def tell(self):
        return 0

    def seek(self, offset, whence=0):
        if offset == 0 and whence == 0:
            return 0
        import errno
        raise OSError(errno.ESPIPE, "Illegal seek")

    def readable(self): return 'r' in self.mode
    def writable(self): return 'w' in self.mode
    def seekable(self): return False

    def close(self):
        self.closed = True
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
        root = "/tmp/phone_ftp_root"
        # Aggressively strip the local root prefix if it was double-prepended by pyftpdlib
        temp_path = path
        while temp_path.startswith(root):
            temp_path = temp_path[len(root):]
            
        if not temp_path.startswith("/"):
            temp_path = "/" + temp_path
            
        res = "/storage/emulated/0" + temp_path
        return res

    def stat(self, path):
        mapped = self._map(path)
        if mapped in self._stat_cache:
            return self._stat_cache[mapped]
            
        try:
            res = sync_phone_fs_request("fs_stat", path=mapped)
            if not res or not res.get("success"):
                raise FileNotFoundError(2, "No such file or directory")
            
            d = res.get("data", {})
            st = StatObj(d.get("size", 0), d.get("is_dir", False), d.get("mtime", 0))
            self._stat_cache[mapped] = st
            return st
        except Exception as e:
            logger.debug(f"Stat failed for {path} ({mapped}): {e}")
            raise FileNotFoundError(2, "No such file or directory")

    def listdir(self, path):
        mapped = self._map(path)
        try:
            res = sync_phone_fs_request("fs_list", path=mapped)
            if not res or not res.get("success"):
                logger.error(f"Listdir error from Android: {res.get('error', 'Unknown Error')}")
                raise FileNotFoundError(2, "No such file or directory")
                
            names = []
            for f in res.get("data", []):
                name = f["name"]
                names.append(name)
                # Populate cache using mapped path for subsequent STAT calls
                m_path = os.path.join(mapped, name)
                size = f.get("size", 0)
                self._stat_cache[m_path] = StatObj(size, f.get("is_dir", False), f.get("mtime", 0))
            return names
        except Exception as e:
            logger.error(f"Listdir failed for {path} ({mapped}): {e}")
            raise FileNotFoundError(2, "No such file or directory")

    def isdir(self, path):
        try:
            return stat_module.S_ISDIR(self.stat(path).st_mode)
        except:
            return False
            
    def exists(self, path):
        try:
            self.stat(path)
            return True
        except:
            return False

    def chdir(self, path):
        # We don't actually change the local process directory.
        # We just need to verify the path is valid for CWD to succeed in FTPHandler.
        if not self.isdir(path):
            raise FileNotFoundError(2, "No such file or directory")
        self._cwd = self.realpath(path)

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

    def format_list(self, basedir, listing, ignore_err=True):
        for name in listing:
            path = os.path.join(basedir, name)
            try:
                st = self.stat(path)
            except Exception:
                if ignore_err: continue
                raise
            perms = "drwxrwxrwx" if stat_module.S_ISDIR(st.st_mode) else "-rw-rw-rw-"
            import datetime
            dt = datetime.datetime.fromtimestamp(st.st_mtime)
            datestr = dt.strftime("%b %d %H:%M")
            yield f"{perms} 1 1000 1000 {st.st_size:>8} {datestr} {name}\r\n".encode('utf-8')

    def format_mlsx(self, basedir, listing, perms, facts, ignore_err=True):
        for name in listing:
            path = os.path.join(basedir, name)
            try:
                st = self.stat(path)
            except Exception:
                if ignore_err: continue
                raise
            ptype = "dir" if stat_module.S_ISDIR(st.st_mode) else "file"
            import datetime
            dt = datetime.datetime.fromtimestamp(st.st_mtime)
            datestr = dt.strftime("%Y%m%d%H%M%S")
            yield f"Type={ptype};Size={st.st_size};Modify={datestr}; {name}\r\n".encode('utf-8')

class PhoneHandler(FTPHandler):
    pass

def wait_and_run_ftp():
    homedir = "/tmp/phone_ftp_root"
    os.makedirs(homedir, exist_ok=True)
    authorizer = DummyAuthorizer()
    authorizer.add_anonymous(homedir, perm="elradfmwMT")
    
    handler = PhoneHandler
    handler.authorizer = authorizer
    handler.abstracted_fs = PhoneFS
    handler.use_sendfile = False
    handler.passive_ports = range(60000, 60100) # Optional: help with firewall
    
    logger.info("Starting FTP server on port 2121")
    server = FTPServer(("127.0.0.1", 2121), handler)
    server.serve_forever()

def start_phone_ftp_server():
    threading.Thread(target=wait_and_run_ftp, daemon=True).start()
