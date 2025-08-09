import http.server
import socketserver
import webbrowser
import threading
import time

PORT = 8000  # You can choose a different port if 8000 is in use

Handler = http.server.SimpleHTTPRequestHandler

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"Access your site at http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    # Start the server in a separate thread to allow the main thread to open the browser
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True  # Allows the program to exit even if the server thread is running
    server_thread.start()

    # Give the server a moment to start up
    time.sleep(1)

    # Open the local site in the default web browser
    webbrowser.open_new_tab(f"http://localhost:{PORT}")

    # Keep the main thread alive so the server continues to run
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServer stopped.")