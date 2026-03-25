function Get-DefaultBrandRules {
    return [ordered]@{
        tone = 'institucional, técnico, claro e confiável'
        required_traits = @(
            'autoridade técnica',
            'clareza argumentativa',
            'objetividade',
            'foco em impacto de negócio'
        )
        recommended_terms = @(
            'governança',
            'conformidade',
            'transformação',
            'estratégia',
            'dados',
            'regulação',
            'eficiência',
            'decisão'
        )
        forbidden_terms = @(
            'galera',
            'super',
            'top',
            'imperdível',
            'bombástico'
        )
        restrictions = @(
            'evitar informalidade excessiva',
            'evitar adjetivação vazia',
            'evitar redundâncias',
            'priorizar construções assertivas'
        )
        positioning = 'consultoria estratégica com profundidade técnica e linguagem executiva'
    }
}

function Convert-BrandTextToRules {
    param([string]$BrandText)

    $rules = Get-DefaultBrandRules
    if (-not $BrandText) {
        return $rules
    }

    $lower = $BrandText.ToLowerInvariant()
    if ($lower -match 'linkedin') {
        $rules.channel = 'LinkedIn'
    }
    if ($lower -match 'institucional') {
        $rules.tone = 'institucional'
    }
    if ($lower -match 't[ée]cnico') {
        $rules.required_traits += 'rigor técnico'
    }
    if ($lower -match 'claro|clareza') {
        $rules.required_traits += 'clareza'
    }
    if ($lower -match 'evitar') {
        $rules.restrictions += 'seguir restrições explícitas do brandbook importado'
    }

    $matches = [regex]::Matches($BrandText, '(?im)(permitid[ao]s?|recomendad[ao]s?|prefer[íi]veis?)[:\-]\s*(.+)$')
    foreach ($match in $matches) {
        $rules.recommended_terms += @($match.Groups[2].Value -split '[,;]' | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
    }

    $negativeMatches = [regex]::Matches($BrandText, '(?im)(proibid[ao]s?|evitar|n[ãa]o usar)[:\-]\s*(.+)$')
    foreach ($match in $negativeMatches) {
        $rules.forbidden_terms += @($match.Groups[2].Value -split '[,;]' | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
    }

    $rules.required_traits = @($rules.required_traits | Select-Object -Unique)
    $rules.recommended_terms = @($rules.recommended_terms | Select-Object -Unique)
    $rules.forbidden_terms = @($rules.forbidden_terms | Select-Object -Unique)
    $rules.restrictions = @($rules.restrictions | Select-Object -Unique)
    return $rules
}

function Get-BrandRules {
    param(
        [string]$BrandText,
        [string]$SeedRulesPath
    )

    $rules = if ($SeedRulesPath -and (Test-Path $SeedRulesPath)) {
        $jsonObject = Get-Content -Path $SeedRulesPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $hash = [ordered]@{}
        foreach ($property in $jsonObject.PSObject.Properties) {
            $hash[$property.Name] = $property.Value
        }
        $hash
    }
    else {
        Get-DefaultBrandRules
    }

    $derived = Convert-BrandTextToRules -BrandText $BrandText
    foreach ($key in $derived.Keys) {
        if ($derived[$key] -is [System.Array]) {
            $merged = @($rules[$key]) + @($derived[$key])
            $rules[$key] = @($merged | Where-Object { $_ } | Select-Object -Unique)
        }
        elseif ($derived[$key]) {
            $rules[$key] = $derived[$key]
        }
    }

    return $rules
}

Export-ModuleMember -Function Get-BrandRules, Get-DefaultBrandRules, Convert-BrandTextToRules
