Import-Module (Join-Path $PSScriptRoot '..\Models.psm1') -Force

function Invoke-GrammarValidator {
    param([string]$Text)

    $issues = @()
    $suggestions = @()
    $score = 10.0

    if ($Text -match '\s{2,}') {
        $issues += New-ValidationIssue -Type 'grammar' -Description 'Há espaços duplicados no texto.' -Severity 'low'
        $suggestions += 'Remover espaços duplicados.'
        $score -= 0.5
    }

    if ($Text -match ',,|;;|\.\.') {
        $issues += New-ValidationIssue -Type 'grammar' -Description 'Há sinais de pontuação duplicados ou inconsistentes.' -Severity 'medium'
        $suggestions += 'Revisar pontuação duplicada e encadeamento de frases.'
        $score -= 1.2
    }

    $sentenceCount = @($Text -split '(?<=[\.\!\?])\s+' | Where-Object { $_.Trim() }).Count
    $commaCount = ([regex]::Matches($Text, ',')).Count
    if ($sentenceCount -gt 0 -and ($commaCount / $sentenceCount) -gt 4) {
        $issues += New-ValidationIssue -Type 'grammar' -Description 'Há excesso de orações encadeadas por vírgulas, o que pode indicar problema sintático.' -Severity 'medium'
        $suggestions += 'Dividir períodos longos em frases mais controladas.'
        $score -= 1.0
    }

    if ($Text -match '(?i)\b(a gente|pra|tá|tipo)\b') {
        $issues += New-ValidationIssue -Type 'grammar' -Description 'Foram encontradas construções coloquiais incompatíveis com comunicação institucional.' -Severity 'high'
        $suggestions += 'Substituir formas coloquiais por construções formais.'
        $score -= 2.0
    }

    return New-ModuleResult -Name 'grammar' -Score $score -Issues $issues -Suggestions ($suggestions | Select-Object -Unique)
}

Export-ModuleMember -Function Invoke-GrammarValidator
