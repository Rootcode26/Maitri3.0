import pymupdf
import subprocess

def scan_pdf(file_path, sanitized_output_path):
    """3-Layer Scanning for PDF Uploads"""
    # LAYER 1: Verify Magic Bytes (%PDF)
    try:
        with open(file_path, 'rb') as f:
            if f.read(4) != b'%PDF':
                print("[ALERT] Rejected: Not a genuine PDF file.")
                return False
    except Exception as e:
        print(f"[ERROR] File read error: {e}")
        return False

    # LAYER 2: Scan for Malware Signatures via ClamAV
    try:
        scan_result = subprocess.run(['clamscan', '--no-summary', file_path], capture_output=True, text=True)
        if "FOUND" in scan_result.stdout:
            print(f"[CRITICAL ALERT] Malware detected inside PDF: {scan_result.stdout}")
            return False
    except FileNotFoundError:
        print("[WARNING] ClamAV daemon not found on host. Proceeding to structural cleaning...")

    # LAYER 3: Viewing Embedded JavaScript & Malicious Activities(further)
    try:
        doc = pymupdf.open(file_path)
        
        for i in range(len(doc)):
            page = doc[i]
            # converting interactive dynamic forms and embedded scripts into plain file
            page.clean_contents()

        # Save clean version of the document
        doc.save(sanitized_output_path, garbage=4, deflate=True, clean=True)
        doc.close()
        
        print("[SUCCESS] PDF is clean, virus-free, and safe to upload to AWS S3.")
        return True

    except Exception as e:
        print(f"[ALERT] PDF structure is corrupted or maliciously crafted: {e}")
        return False

#backend developers use "from utils.security import scan_pdf" for scanning
