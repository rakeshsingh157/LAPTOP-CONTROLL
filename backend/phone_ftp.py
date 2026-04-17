import os
import threading
import sys
import tempfile
import socket
import logging
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.filesystems import AbstractedFS

from routes.system import sync_phone_fs_request, PHONE_WS_CONNECTION

class PhoneTCPFile:
    def __init__(self, mode, file_path):
        self.mode = mode
        self.file_path = file_path
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.bind(("0.0.0.0", 0))
        self.port = self.sock.getsockname()[1]
        self.sock.listen(1)
        
        self.client_sock = None
        self._file_obj = None
        
        if 'r' in mode:
            # Tell phone to connect and send the file to this port
            sync_phone_fs_request("fs_send_tcp", path=file_path, port=self.port)
            self.client_sock, _ = self.sock.accept()
            self._file_obj = self.client_sock.makefile('rb')
        elif 'w' in mode:
            # Tell phone to connect and receive the file from this port
            sync_phone_fs_request("fs_recv_tcp", path=file_path, port=self.port)
            self.client_sock, _ = self.sock.accept()
            self._file_obj = self.client_sock.makefile('wb')

    def read(self, size):
        return self._file_obj.read(size)

    def write(self, data):
        self._file_obj.write(data)

    def close(self):
        if self._file_obj:
            self._file_obj.close()
        if self.client_sock:
            self.client_sock.close()
        self.sock.close()


class PhoneFS(AbstractedFS):
    def stat(self, path):
        try:
            res = sync_phone_fs_request("fs_stat", path=path)
        except Exception:
            raise FileNotFoundError()
        if not res.get("success"):
            raise FileNotFoundError()
        d = res.get("data", {})
        
        class StatObj:
            def __init__(self, size, is_dir, mtime):
                self.st_size = size
                self.st_mtime = mtime
                self.st_mode = 0o40777 if is_dir else 0o100666
        return StatObj(d["size"], d.get("is_dir", False), d.get("mtime", 0))

    def listdir(self, path):
        try:
            res = sync_phone_fs_request("fs_list", path=path)
        except Exception:
            raise FileNotFoundError()
        if not res.get("success"):
            raise FileNotFoundError()
        return [f["name"] for f in res.get("data", [])]

    def isdir(self, path):
        try:
            return self.stat(path).st_mode == 0o40777
        except FileNotFoundError:
            return False

    def isfile(self, path):
        try:
            return self.stat(path).st_mode == 0o100666
        except FileNotFoundError:
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
        except FileNotFoundError:
            return False

    def get_user_by_uid(self, uid):
        return "root"

    def get_group_by_gid(self, gid):
        return "root"
        
    def realpath(self, path):
        return path
        
    def remove(self, path):
        res = sync_phone_fs_request("fs_delete", path=path)
        if not res.get("success"):
            raise OSError()

    def rmdir(self, path):
        self.remove(path)

    def mkdir(self, path):
        res = sync_phone_fs_request("fs_mkdir", path=path)
        if not res.get("success"):
            raise OSError()
            
    def rename(self, src, dst):
        res = sync_phone_fs_request("fs_rename", src=src, dst=dst)
        if not res.get("success"):
            raise OSError()

    def chmod(self, path, mode):
        pass # Phone FS ignores chmod locally

    def format_list(self, basedir, listing, ignore_err=True):
        # pyftpdlib uses os.path directly here unless we override.
        for name in listing:
            path = os.path.join(basedir, name)
            try:
                st = self.stat(path)
            except OSError:
                if ignore_err:
                    continue
                raise
            perms = "drwxrwxrwx" if st.st_mode == 0o40777 else "-rw-rw-rw-"
            yield f"{perms} 1 root root {st.st_size:>8} Jan 01 00:00 {name}\r\n"

    def format_mlsx(self, basedir, listing, perms, facts, ignore_err=True):
        for name in listing:
            path = os.path.join(basedir, name)
            try:
                st = self.stat(path)
            except OSError:
                if ignore_err:
                    continue
                raise
            ptype = "dir" if st.st_mode == 0o40777 else "file"
            # Simple format 
            yield f"Type={ptype};Size={st.st_size};Modify=19700101000000; {name}\r\n"


    def open(self, filename, mode):
        return PhoneTCPFile(mode, filename)


def wait_and_run_ftp():
    authorizer = DummyAuthorizer()
    authorizer.add_anonymous("/sdcard", perm="elradfmwMT")
    handler = FTPHandler
    handler.authorizer = authorizer
    handler.abstracted_fs = PhoneFS
    
    server = FTPServer(("127.0.0.1", 2121), handler)
    print("🚀 Phone storage FTP server listening on ftp://127.0.0.1:2121")
    server.serve_forever()

def start_phone_ftp_server():
    threading.Thread(target=wait_and_run_ftp, daemon=True).start()

