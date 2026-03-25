Import-Module (Join-Path $PSScriptRoot 'ReferenceProfileService.psm1') -Force

function Get-ImprovedVersion {
    param(
        [string]$Text,
        [hashtable]$BrandRules,
        [hashtable]$ReferenceProfile,
        [array]$Suggestions
    )

    $result = $Text.Trim()
    $result = $result -replace '\s{2,}', ' '
    $result = $result -replace '\.\.', '.'
    $result = $result -replace '\s+,', ','

    if ($result -notmatch '(?i)governan[çc]a|estrat[ée]gia|conformidade|dados') {
        $result += ' O conteúdo reforça a importância de uma atuação orientada por governança, clareza executiva e impacto estratégico.'
    }

    if ($ReferenceProfile.preferred_vocabulary.Count -gt 0) {
        $firstTerm = $ReferenceProfile.preferred_vocabulary | Where-Object { $_ -match 'governan|regula|dados|qualidade|estrat' } | Select-Object -First 1
        if ($firstTerm -and $result.ToLowerInvariant() -notmatch [regex]::Escape($firstTerm)) {
            $result += ' Esse posicionamento amplia a consistência da mensagem e a percepção de autoridade técnica.'
        }
    }

    if ($BrandRules.positioning -and $result -notmatch '(?i)consultoria|estrat') {
        $result += ' A abordagem deve traduzir complexidade técnica em decisão de negócio com linguagem institucional.'
    }

    return $result.Trim()
}

Export-ModuleMember -Function Get-ImprovedVersion
