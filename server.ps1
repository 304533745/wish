# A dependency-free, loopback-only static server. All files come from this folder.
$ErrorActionPreference = 'Stop'
$siteRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$port = 4173
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
try { $listener.Start() } catch { Write-Host 'Port 4173 is busy. Open http://127.0.0.1:4173/ or double-click index.html.'; exit 1 }
Write-Host 'Jieluo Wish is running at http://127.0.0.1:4173/'
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
$mimeTypes = @{ '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp' }
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 3000
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $line = $reader.ReadLine()
            if (-not $line) { continue }
            do { $header = $reader.ReadLine() } while ($header)
            $parts = $line.Split(' ')
            $requestPath = [System.Uri]::UnescapeDataString(($parts[1].Split('?')[0])).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            if ($requestPath -eq '\') { $requestPath = '\index.html' }
            $relative = $requestPath.TrimStart([char]'\')
            $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($siteRoot, $relative))
            $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
            $isPublic = $relative -in @('index.html', 'styles.css', 'engine.js', 'app.js') -or $relative.StartsWith('assets\', [System.StringComparison]::OrdinalIgnoreCase)
            if ($parts[0] -notin @('GET', 'HEAD')) {
                $status = '405 Method Not Allowed'; $contentType = 'text/plain'; $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
            } elseif (-not $fullPath.StartsWith($siteRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -or -not $isPublic -or -not $mimeTypes.ContainsKey($extension) -or -not [System.IO.File]::Exists($fullPath)) {
                $status = '404 Not Found'; $contentType = 'text/plain'; $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
            } else {
                $status = '200 OK'; $contentType = $mimeTypes[$extension]; $body = [System.IO.File]::ReadAllBytes($fullPath)
            }
            $response = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
            $bytes = [System.Text.Encoding]::ASCII.GetBytes($response)
            $stream.Write($bytes, 0, $bytes.Length)
            if ($parts[0] -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
        } catch { Write-Host ('Request skipped: ' + $_.Exception.Message) }
        finally { if ($reader) { $reader.Dispose(); $reader = $null }; $client.Dispose() }
    }
} finally { $listener.Stop() }
