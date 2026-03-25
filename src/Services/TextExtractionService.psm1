function Get-FileExtension {
    param([string]$Path)
    return [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
}

function ConvertFrom-Docx {
    param([string]$Path)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' } | Select-Object -First 1
        if (-not $entry) {
            return ''
        }

        $reader = [System.IO.StreamReader]::new($entry.Open())
        try {
            $xml = $reader.ReadToEnd()
        }
        finally {
            $reader.Close()
        }

        $text = [regex]::Replace($xml, '<w:tab[^>]*/>', ' ')
        $text = [regex]::Replace($text, '</w:p>', "`n")
        $text = [regex]::Replace($text, '<[^>]+>', '')
        $text = [System.Net.WebUtility]::HtmlDecode($text)
        $text = [regex]::Replace($text, "(\r?\n){2,}", "`n")
        return $text.Trim()
    }
    finally {
        $zip.Dispose()
    }
}

function ConvertFrom-PdfFallback {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $raw = [System.Text.Encoding]::ASCII.GetString($bytes)
    $candidates = [regex]::Matches($raw, '[A-Za-z0-9][A-Za-z0-9 ,;:()/\-]{5,}')
    $lines = foreach ($match in $candidates) {
        $value = $match.Value.Trim()
        if ($value.Length -ge 6 -and $value -match '[A-Za-z]{3,}') {
            $value
        }
    }

    return ($lines | Select-Object -Unique) -join "`n"
}

function Get-PlainTextContent {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Arquivo não encontrado: $Path"
    }

    $extension = Get-FileExtension -Path $Path

    switch ($extension) {
        '.txt' { return (Get-Content -Path $Path -Raw -Encoding UTF8) }
        '.md' { return (Get-Content -Path $Path -Raw -Encoding UTF8) }
        '.json' { return (Get-Content -Path $Path -Raw -Encoding UTF8) }
        '.docx' { return (ConvertFrom-Docx -Path $Path) }
        '.pdf' { return (ConvertFrom-PdfFallback -Path $Path) }
        default { return (Get-Content -Path $Path -Raw -Encoding UTF8) }
    }
}

function Get-ContentFromPathSet {
    param([string[]]$Paths)

    $items = @()
    foreach ($path in $Paths) {
        if (-not $path) {
            continue
        }

        if (Test-Path $path -PathType Container) {
            $files = Get-ChildItem -Path $path -File -Recurse
            foreach ($file in $files) {
                $items += [ordered]@{
                    path = $file.FullName
                    text = Get-PlainTextContent -Path $file.FullName
                }
            }
        }
        else {
            $items += [ordered]@{
                path = (Resolve-Path $path).Path
                text = Get-PlainTextContent -Path $path
            }
        }
    }

    return @($items)
}

Export-ModuleMember -Function Get-PlainTextContent, Get-ContentFromPathSet
