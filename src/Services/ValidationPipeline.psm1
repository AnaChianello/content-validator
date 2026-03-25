Import-Module (Join-Path $PSScriptRoot '..\Models.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'TextExtractionService.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'ReferenceProfileService.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'BrandRuleService.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'RewriteService.psm1') -Force
Import-Module (Join-Path $PSScriptRoot '..\Validators\GrammarValidator.psm1') -Force
Import-Module (Join-Path $PSScriptRoot '..\Validators\ToneValidator.psm1') -Force
Import-Module (Join-Path $PSScriptRoot '..\Validators\ClarityValidator.psm1') -Force
Import-Module (Join-Path $PSScriptRoot '..\Validators\BrandComplianceValidator.psm1') -Force
Import-Module (Join-Path $PSScriptRoot '..\Validators\ConsistencyValidator.psm1') -Force

function Get-WeightedFinalScore {
    param([hashtable]$ModuleScores)

    $weights = @{
        grammar = 0.15
        tone = 0.25
        clarity = 0.20
        brand_compliance = 0.30
        consistency = 0.10
    }

    $total = 0.0
    foreach ($key in $weights.Keys) {
        $total += ($ModuleScores[$key] * $weights[$key])
    }

    return [Math]::Round($total, 2)
}

function Invoke-ContentValidation {
    param(
        [string]$Text,
        [string[]]$ReferencePaths,
        [string]$BrandbookPath,
        [string]$SeedRulesPath
    )

    $referenceItems = Get-ContentFromPathSet -Paths $ReferencePaths
    $referenceProfile = Get-ReferenceProfile -ReferenceItems $referenceItems
    $brandText = if ($BrandbookPath) { Get-PlainTextContent -Path $BrandbookPath } else { '' }
    $brandRules = Get-BrandRules -BrandText $brandText -SeedRulesPath $SeedRulesPath

    $grammar = Invoke-GrammarValidator -Text $Text
    $tone = Invoke-ToneValidator -Text $Text -ReferenceProfile $referenceProfile -ReferenceItems $referenceItems
    $clarity = Invoke-ClarityValidator -Text $Text
    $brand = Invoke-BrandComplianceValidator -Text $Text -BrandRules $brandRules
    $consistency = Invoke-ConsistencyValidator -Text $Text

    $moduleScores = [ordered]@{
        grammar = $grammar.score
        tone = $tone.score
        clarity = $clarity.score
        brand_compliance = $brand.score
        consistency = $consistency.score
    }

    $issues = @($grammar.issues + $tone.issues + $clarity.issues + $brand.issues + $consistency.issues)
    $suggestions = @($grammar.suggestions + $tone.suggestions + $clarity.suggestions + $brand.suggestions + $consistency.suggestions | Select-Object -Unique)
    $improvedVersion = Get-ImprovedVersion -Text $Text -BrandRules $brandRules -ReferenceProfile $referenceProfile -Suggestions $suggestions
    $semanticOverlap = Find-SemanticOverlap -InputText $Text -ReferenceItems $referenceItems | Select-Object -First 3

    $finalScore = Get-WeightedFinalScore -ModuleScores $moduleScores
    $summary = if ($finalScore -ge 8.5) {
        'Conteúdo fortemente aderente ao padrão institucional, com pequenos ajustes editoriais.'
    }
    elseif ($finalScore -ge 7.0) {
        'Conteúdo consistente, mas ainda precisa de refinamentos de tom, clareza ou aderência de marca.'
    }
    else {
        'Conteúdo parcialmente aderente; recomenda-se revisão editorial antes da publicação.'
    }

    return [ordered]@{
        final_score = $finalScore
        summary = $summary
        module_scores = $moduleScores
        issues = @($issues)
        suggestions = @($suggestions)
        improved_version = $improvedVersion
        diagnostics = [ordered]@{
            reference_profile = $referenceProfile
            semantic_overlap = @($semanticOverlap)
            brand_rules = $brandRules
        }
    }
}

Export-ModuleMember -Function Invoke-ContentValidation
