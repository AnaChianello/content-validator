param(
    [string]$BrandbookPath = 'C:\Users\ChianelloAna(BipGrou\Downloads\BIP Brand Guidelines 2025 (1).pdf'
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Import-Module "$PSScriptRoot\..\src\Services\ValidationPipeline.psm1" -Force

$text = @'
Neste novo episódio da série Vozes Femininas, Stephanie, Gerente na BIP Brasil, analisa os desafios de atuar em um setor majoritariamente masculino. Com três anos de trajetória na consultoria, ela destaca que o conhecimento técnico profundo e o posicionamento assertivo são as chaves para consolidar o espaço de liderança das mulheres no mercado financeiro. 

A executiva reforça que a construção de uma rede de apoio é um diferencial estratégico contínuo. Inspirada por lideranças da própria BIP e por sua base familiar, Stephanie atua ativamente na formação de equipes femininas de alta performance, promovendo um ciclo de fortalecimento e valorização de profissionais altamente capacitadas. 

Assista ao vídeo e conheça a visão de quem transforma excelência técnica em protagonismo. 
'@

$referencePaths = @(
    "$PSScriptRoot\..\data\reference-posts"
)

$seedRulesPath = "$PSScriptRoot\..\data\brandbook\seed-brand-rules.json"

$result = Invoke-ContentValidation -Text $text -ReferencePaths $referencePaths -BrandbookPath $BrandbookPath -SeedRulesPath $seedRulesPath
$result | ConvertTo-Json -Depth 8
