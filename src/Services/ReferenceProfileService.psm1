Import-Module (Join-Path $PSScriptRoot '..\Models.psm1') -Force

function Get-NormalizedTokens {
    param([string]$Text)

    $normalized = ($Text.ToLowerInvariant() -replace '[^a-zà-ÿ0-9\s-]', ' ')
    return @($normalized -split '\s+' | Where-Object { $_.Length -gt 2 })
}

function Get-SentenceStats {
    param([string]$Text)

    $sentences = @($Text -split '(?<=[\.\!\?])\s+' | Where-Object { $_.Trim().Length -gt 0 })
    if (-not $sentences.Count) {
        return @{ average = 0; max = 0; min = 0 }
    }

    $lengths = $sentences | ForEach-Object { ((Get-NormalizedTokens -Text $_).Count) }

    return @{
        average = [Math]::Round((($lengths | Measure-Object -Average).Average), 2)
        max = ($lengths | Measure-Object -Maximum).Maximum
        min = ($lengths | Measure-Object -Minimum).Minimum
    }
}

function Get-ReferenceProfile {
    param([array]$ReferenceItems)

    $texts = @($ReferenceItems | ForEach-Object { $_.text } | Where-Object { $_ })
    $joined = ($texts -join "`n")
    $tokens = Get-NormalizedTokens -Text $joined
    $topVocabulary = $tokens | Group-Object | Sort-Object Count -Descending | Select-Object -First 20 | ForEach-Object { $_.Name }
    $sentenceStats = Get-SentenceStats -Text $joined

    $structuralPatterns = @()
    if ($joined -match 'Frame\s+\d+') { $structuralPatterns += 'carrossel estruturado por frames' }
    if ($joined -match 'Título:|Titulo:') { $structuralPatterns += 'uso recorrente de títulos explícitos' }
    if ($joined -match 'Conteúdo:|Conteudo:') { $structuralPatterns += 'blocos explicativos com marcadores conceituais' }
    if ($joined -match 'Acesse:|Saiba mais:') { $structuralPatterns += 'fechamento com CTA para aprofundamento' }

    $dominantTone = 'institucional, técnico e orientado a clareza regulatória'
    $formality = 'alto'
    if ($joined -match 'Nosso novo artigo|Conheça|Conheca|Acesse') {
        $dominantTone = 'institucional e técnico, com CTA consultivo'
    }

    $summary = 'Texto com forte viés institucional, vocabulário regulatório, frases declarativas e estrutura didática orientada a autoridade técnica.'

    $metrics = @{
        reference_count = $texts.Count
        token_count = $tokens.Count
        average_sentence_length = $sentenceStats.average
        structural_density = $structuralPatterns.Count
    }

    return New-ReferenceProfile `
        -Summary $summary `
        -DominantTone $dominantTone `
        -Formality $formality `
        -StructuralPatterns $structuralPatterns `
        -PreferredVocabulary $topVocabulary `
        -Metrics $metrics
}

function Get-TokenSimilarity {
    param(
        [string]$Left,
        [string]$Right
    )

    $leftTokens = Get-NormalizedTokens -Text $Left
    $rightTokens = Get-NormalizedTokens -Text $Right

    if (-not $leftTokens.Count -or -not $rightTokens.Count) {
        return 0
    }

    $leftSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$leftTokens)
    $rightSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$rightTokens)
    $intersection = [System.Collections.Generic.HashSet[string]]::new($leftSet)
    $intersection.IntersectWith($rightSet)
    $union = [System.Collections.Generic.HashSet[string]]::new($leftSet)
    $union.UnionWith($rightSet)

    if (-not $union.Count) {
        return 0
    }

    return [Math]::Round(($intersection.Count / $union.Count), 4)
}

function Find-SemanticOverlap {
    param(
        [string]$InputText,
        [array]$ReferenceItems
    )

    $overlaps = foreach ($item in $ReferenceItems) {
        $similarity = Get-TokenSimilarity -Left $InputText -Right $item.text
        [ordered]@{
            path = $item.path
            similarity = $similarity
        }
    }

    return @($overlaps | Sort-Object similarity -Descending)
}

Export-ModuleMember -Function Get-ReferenceProfile, Find-SemanticOverlap, Get-NormalizedTokens, Get-TokenSimilarity
