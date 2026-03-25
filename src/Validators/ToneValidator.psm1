Import-Module (Join-Path $PSScriptRoot '..\Models.psm1') -Force
Import-Module (Join-Path $PSScriptRoot '..\Services\ReferenceProfileService.psm1') -Force

function Invoke-ToneValidator {
    param(
        [string]$Text,
        [hashtable]$ReferenceProfile,
        [array]$ReferenceItems
    )

    $issues = @()
    $suggestions = @()
    $score = 10.0

    $inputLower = $Text.ToLowerInvariant()
    if ($inputLower -match '\b(galera|super|top|sensacional|imperd[íi]vel)\b') {
        $issues += New-ValidationIssue -Type 'tone' -Description 'O texto adota expressões promocionais ou informais destoantes do tom institucional.' -Severity 'high'
        $suggestions += 'Substituir expressões promocionais por linguagem consultiva e objetiva.'
        $score -= 2.5
    }

    if ($inputLower -notmatch '\b(conformidade|estrat[ée]gia|governan[çc]a|efici[êe]ncia|dados|regula[çc][ãa]o)\b') {
        $issues += New-ValidationIssue -Type 'tone' -Description 'O texto carece de ancoragem em vocabulário técnico e executivo típico da empresa.' -Severity 'medium'
        $suggestions += 'Adicionar termos que reforcem autoridade técnica e relevância de negócio.'
        $score -= 1.5
    }

    $overlap = Find-SemanticOverlap -InputText $Text -ReferenceItems $ReferenceItems | Select-Object -First 1
    if ($overlap -and $overlap.similarity -lt 0.12) {
        $issues += New-ValidationIssue -Type 'tone' -Description 'A distância semântica em relação ao histórico é alta, sugerindo desalinhamento de tom e repertório.' -Severity 'medium'
        $suggestions += 'Aproximar o texto da linguagem técnico-consultiva usada nos posts de referência.'
        $score -= 1.2
    }

    if ($Text -notmatch '[:;]' -and $ReferenceProfile.structural_patterns.Count -gt 0) {
        $issues += New-ValidationIssue -Type 'tone' -Description 'O texto aproveita pouco a estrutura didática observada no histórico.' -Severity 'low'
        $suggestions += 'Considerar subtítulos ou blocos conceituais para reforçar clareza institucional.'
        $score -= 0.6
    }

    return New-ModuleResult -Name 'tone' -Score $score -Issues $issues -Suggestions ($suggestions | Select-Object -Unique) -Metadata @{ top_similarity = $overlap.similarity }
}

Export-ModuleMember -Function Invoke-ToneValidator
