function New-ValidationIssue {
    param(
        [string]$Type,
        [string]$Description,
        [ValidateSet('low', 'medium', 'high')][string]$Severity = 'medium'
    )

    return [ordered]@{
        type = $Type
        description = $Description
        severity = $Severity
    }
}

function New-ModuleResult {
    param(
        [string]$Name,
        [double]$Score,
        [array]$Issues = @(),
        [array]$Suggestions = @(),
        [hashtable]$Metadata = @{}
    )

    return [ordered]@{
        name = $Name
        score = [Math]::Round([Math]::Max(0, [Math]::Min(10, $Score)), 2)
        issues = @($Issues)
        suggestions = @($Suggestions)
        metadata = $Metadata
    }
}

function New-ReferenceProfile {
    param(
        [string]$Summary,
        [string]$DominantTone,
        [string]$Formality,
        [string[]]$StructuralPatterns,
        [string[]]$PreferredVocabulary,
        [hashtable]$Metrics
    )

    return [ordered]@{
        summary = $Summary
        dominant_tone = $DominantTone
        formality = $Formality
        structural_patterns = @($StructuralPatterns)
        preferred_vocabulary = @($PreferredVocabulary)
        metrics = $Metrics
    }
}

Export-ModuleMember -Function New-ValidationIssue, New-ModuleResult, New-ReferenceProfile
