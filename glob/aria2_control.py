
import os
import subprocess
import logging
import sys
import threading
import re

# Check if aria2c is installed
def is_aria2c_installed():
    try:
        subprocess.run(['aria2c', '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False

def get_hf_mirror_url(url):
    if url.startswith("https://huggingface.co"):
        return url.replace("https://huggingface.co", "https://hf-mirror.com")
    return url

def handle_stream(stream, prefix, log_file=None):
    for msg in stream:
        if log_file:
            log_file.write(msg)
            log_file.flush()
        
        # Simple progress parsing for aria2c
        # aria2c output example: [AWS] [ 10% 10/100 MB 1.2MB/s CN:1 ETA:1m ]
        # We can just print it to stderr/stdout so ComfyUI manager's existing mechanism might pick it up if running in foreground
        # Or we can try to parse it.
        print(msg, end="", file=sys.stderr)

def aria2_download(url, save_path, filename):
    if not is_aria2c_installed():
        logging.error("[ComfyUI-Manager] aria2c is not installed.")
        return False

    url = get_hf_mirror_url(url)
    
    if not os.path.exists(save_path):
        os.makedirs(save_path)

    cmd = [
        'aria2c',
        '-x', '16',
        '-s', '16',
        url,
        '-d', save_path,
        '-o', filename,
        '--allow-overwrite=true',
        '--auto-file-renaming=false',
        '--console-log-level=notice',
        '--summary-interval=1'
    ]

    logging.info(f"[ComfyUI-Manager] Starting aria2c download: {url}")
    
    # Log file for this download
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_path = os.path.join(log_dir, f"aria2_{filename}.log")
    
    try:
        with open(log_path, 'w') as log_file:
            process = subprocess.Popen(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True, 
                bufsize=1
            )
            
            stdout_thread = threading.Thread(target=handle_stream, args=(process.stdout, "", log_file))
            stderr_thread = threading.Thread(target=handle_stream, args=(process.stderr, "[!]", log_file))
            
            stdout_thread.start()
            stderr_thread.start()
            
            stdout_thread.join()
            stderr_thread.join()
            
            ret = process.wait()
            
            if ret == 0:
                logging.info(f"[ComfyUI-Manager] Download completed: {filename}")
                return True
            else:
                logging.error(f"[ComfyUI-Manager] Download failed with exit code {ret}: {filename}")
                return False

    except Exception as e:
        logging.error(f"[ComfyUI-Manager] Exception during aria2c download: {e}")
        return False
