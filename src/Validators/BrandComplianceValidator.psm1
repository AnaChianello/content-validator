Import-Module (Join-Path $PSScriptRoot '..\Models.psm1') -Force

function Invoke-BrandComplianceValidator {
    param(
        [string]$Text,
        [hashtable]$BrandRules
    )

    $issues = @()
    $suggestions = @()
    $score = 10.0
    $lower = $Text.ToLowerInvariant()

    $forbiddenHits = @($BrandRules.forbidden_terms | Where-Object { $_ -and $lower -match "\b$([regex]::Escape($_))\b" })
    if ($forbiddenHits.Count -gt 0) {
        $issues += New-ValidationIssue -Type 'brand' -Description ("Foram detectados termos não aderentes ao brandbook: {0}." -f ($forbiddenHits -join ', ')) -Severity 'high'
        $suggestions += 'Remover expressões incompatíveis com o posicionamento institucional.'
        $score -= [Math]::Min(3.0, 1.0 + (0.6 * $forbiddenHits.Count))
    }

    $recommendedHits = @($BrandRules.recommended_terms | Where-Object { $_ -and $lower -match [regex]::Escape($_) })
    if ($recommendedHits.Count -lt [Math]::Min(2, $BrandRules.recommended_terms.Count)) {
        $issues += New-ValidationIssue -Type 'brand' -Description 'O texto explora pouco a terminologia recomendada pela marca.' -Severity 'medium'
        $suggestions += 'Reforçar o texto com termos estratégicos e técnicos associados ao posicionamento da empresa.'
        $score -= 1.6
    }

    if ($BrandRules.positioning -and $lower -notmatch 'consultoria|estrat[ée]g|governan[çc]a|transforma[çc][ãa]o') {
        $issues += New-ValidationIssue -Type 'brand' -Description 'O alinhamento com o posicionamento estratégico da empresa está fraco.' -Severity 'medium'
        $suggestions += 'Explicitar o impacto estratégico, a autoridade consultiva ou a contribuição para decisão.'
        $score -= 1.8
    }

    return New-ModuleResult -Name 'brand_compliance' -Score $score -Issues $issues -Suggestions ($suggestions | Select-Object -Unique)
}

Export-ModuleMember -Function Invoke-BrandComplianceValidator
