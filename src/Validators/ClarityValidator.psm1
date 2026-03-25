Import-Module (Join-Path $PSScriptRoot '..\Models.psm1') -Force
Import-Module (Join-Path $PSScriptRoot '..\Services\ReferenceProfileService.psm1') -Force

function Invoke-ClarityValidator {
    param([string]$Text)

    $issues = @()
    $suggestions = @()
    $score = 10.0

    $tokens = Get-NormalizedTokens -Text $Text
    $sentences = @($Text -split '(?<=[\.\!\?])\s+' | Where-Object { $_.Trim() })
    if ($sentences.Count -gt 0) {
        $avgSentenceLength = (($sentences | ForEach-Object { (Get-NormalizedTokens -Text $_).Count }) | Measure-Object -Average).Average
        if ($avgSentenceLength -gt 26) {
            $issues += New-ValidationIssue -Type 'clarity' -Description 'Os períodos estão longos, reduzindo objetividade e fluidez.' -Severity 'medium'
            $suggestions += 'Dividir períodos longos e priorizar uma ideia principal por frase.'
            $score -= 1.8
        }
    }

    $duplicates = $tokens | Group-Object | Where-Object { $_.Count -ge 4 -and $_.Name.Length -gt 5 }
    if ($duplicates) {
        $top = $duplicates | Select-Object -First 3 | ForEach-Object { $_.Name }
        $issues += New-ValidationIssue -Type 'clarity' -Description ("Há repetição excessiva de termos: {0}." -f ($top -join ', ')) -Severity 'medium'
        $suggestions += 'Reduzir repetições lexicais e variar construções.'
        $score -= 1.4
    }

    if ($Text -match '(?i)\b(completamente|totalmente|muito|extremamente)\b') {
        $issues += New-ValidationIssue -Type 'clarity' -Description 'Há intensificadores que enfraquecem a objetividade editorial.' -Severity 'low'
        $suggestions += 'Trocar intensificadores por dados, contexto ou formulações mais precisas.'
        $score -= 0.7
    }

    return New-ModuleResult -Name 'clarity' -Score $score -Issues $issues -Suggestions ($suggestions | Select-Object -Unique)
}

Export-ModuleMember -Function Invoke-ClarityValidator
