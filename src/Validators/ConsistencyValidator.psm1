Import-Module (Join-Path $PSScriptRoot '..\Models.psm1') -Force

function Invoke-ConsistencyValidator {
    param([string]$Text)

    $issues = @()
    $suggestions = @()
    $score = 10.0

    $paragraphs = @($Text -split "(\r?\n){2,}" | Where-Object { $_.Trim() })
    if ($paragraphs.Count -gt 1) {
        $firstTopic = $paragraphs[0].ToLowerInvariant()
        $lastTopic = $paragraphs[-1].ToLowerInvariant()
        if (($firstTopic -match 'dados|regula|governan') -and ($lastTopic -match 'evento|promo|desconto')) {
            $issues += New-ValidationIssue -Type 'consistency' -Description 'O texto muda abruptamente de eixo temático, prejudicando coerência interna.' -Severity 'high'
            $suggestions += 'Manter o mesmo fio condutor argumentativo do início ao fim.'
            $score -= 2.2
        }
    }

    if ($Text -match '(?i)\bsempre\b' -and $Text -match '(?i)\bnunca\b') {
        $issues += New-ValidationIssue -Type 'consistency' -Description 'Há absolutos argumentativos que podem gerar contradições implícitas.' -Severity 'low'
        $suggestions += 'Substituir absolutos por formulações mais precisas e defensáveis.'
        $score -= 0.8
    }

    $headings = ([regex]::Matches($Text, '(?im)^(t[íi]tulo|frame|conte[úu]do)')).Count
    if ($headings -gt 0 -and $Text -notmatch '(?i)conclus|acesse|saiba mais|impacto') {
        $issues += New-ValidationIssue -Type 'consistency' -Description 'A estrutura sugere conteúdo explicativo, mas falta fechamento ou conclusão editorial.' -Severity 'medium'
        $suggestions += 'Adicionar fechamento que conecte o conteúdo ao impacto para o público.'
        $score -= 1.1
    }

    return New-ModuleResult -Name 'consistency' -Score $score -Issues $issues -Suggestions ($suggestions | Select-Object -Unique)
}

Export-ModuleMember -Function Invoke-ConsistencyValidator
