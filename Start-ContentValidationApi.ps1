param(
    [int]$Port = 8080,
    [string]$SeedRulesPath = "$PSScriptRoot\data\brandbook\seed-brand-rules.json"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Import-Module "$PSScriptRoot\src\Services\ValidationPipeline.psm1" -Force

function Write-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [byte[]]$BodyBytes,
        [string]$ContentType = 'application/json; charset=utf-8'
    )

    $statusText = switch ($StatusCode) {
        200 { 'OK' }
        404 { 'Not Found' }
        500 { 'Internal Server Error' }
        default { 'OK' }
    }

    $header = "HTTP/1.1 $StatusCode $statusText`r`nContent-Type: $ContentType`r`nContent-Length: $($BodyBytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)

    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
    $Stream.Flush()
}

function Write-JsonResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$Body
    )

    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    Write-HttpResponse -Stream $Stream -StatusCode $StatusCode -BodyBytes $bodyBytes -ContentType 'application/json; charset=utf-8'
}

function Get-StaticFileResponse {
    param(
        [string]$RootPath,
        [string]$RequestPath
    )

    $relativePath = switch ($RequestPath) {
        '/' { 'webui/index.html' }
        '/styles.css' { 'webui/styles.css' }
        '/app.js' { 'webui/app.js' }
        default { $null }
    }

    if (-not $relativePath) {
        return $null
    }

    $fullPath = Join-Path $RootPath $relativePath
    if (-not (Test-Path $fullPath)) {
        return $null
    }

    $contentType = switch ([System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()) {
        '.html' { 'text/html; charset=utf-8' }
        '.css' { 'text/css; charset=utf-8' }
        '.js' { 'application/javascript; charset=utf-8' }
        default { 'application/octet-stream' }
    }

    return @{
        bytes = [System.IO.File]::ReadAllBytes($fullPath)
        contentType = $contentType
    }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host "Content validation API available at http://localhost:$Port/"

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $false, 4096, $true)

            $requestLine = $reader.ReadLine()
            if (-not $requestLine) {
                Write-JsonResponse -Stream $stream -StatusCode 500 -Body '{"error":"Invalid request"}'
                continue
            }

            $headers = @{}
            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) {
                    break
                }

                $parts = $line -split ':\s*', 2
                if ($parts.Count -eq 2) {
                    $headers[$parts[0].ToLowerInvariant()] = $parts[1]
                }
            }

            $segments = $requestLine -split ' '
            $method = $segments[0]
            $path = $segments[1]
            $contentLength = 0
            if ($headers.ContainsKey('content-length')) {
                $contentLength = [int]$headers['content-length']
            }

            $body = ''
            if ($contentLength -gt 0) {
                $buffer = New-Object char[] $contentLength
                [void]$reader.ReadBlock($buffer, 0, $contentLength)
                $body = -join $buffer
            }

            try {
                $staticResponse = Get-StaticFileResponse -RootPath $PSScriptRoot -RequestPath $path
                if ($method -eq 'GET' -and $staticResponse) {
                    Write-HttpResponse -Stream $stream -StatusCode 200 -BodyBytes $staticResponse.bytes -ContentType $staticResponse.contentType
                }
                elseif ($method -eq 'POST' -and $path -eq '/validate') {
                    $payload = $body | ConvertFrom-Json
                    $referencePaths = @()
                    if ($payload.reference_paths) {
                        $referencePaths = @($payload.reference_paths)
                    }

                    $result = Invoke-ContentValidation `
                        -Text $payload.text `
                        -ReferencePaths $referencePaths `
                        -BrandbookPath $payload.brandbook_path `
                        -SeedRulesPath $SeedRulesPath

                    Write-JsonResponse -Stream $stream -StatusCode 200 -Body ($result | ConvertTo-Json -Depth 8)
                }
                else {
                    Write-JsonResponse -Stream $stream -StatusCode 404 -Body '{"error":"Endpoint not found"}'
                }
            }
            catch {
                $errorPayload = [ordered]@{ error = $_.Exception.Message } | ConvertTo-Json
                Write-JsonResponse -Stream $stream -StatusCode 500 -Body $errorPayload
            }
            finally {
                $reader.Close()
            }
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
